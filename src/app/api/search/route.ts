import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

// Generate embedding using Google Gemini
async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: {
          parts: [{ text: text }],
        },
      }),
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    console.error("Gemini API error:", error);
    throw new Error(`Failed to generate embedding: ${error}`);
  }
  
  const data = await response.json();
  return data.embedding.values;
}

// Verify a single profile with Grok (fast)
async function verifySingleProfile(
  query: string,
  profile: any,
  apiKey: string
): Promise<{ include: boolean; reason: string } | null> {
  const profileInfo = `${profile.name} (@${profile.username}): ${profile.summary || profile.bio || "No bio"}`;
  
  const prompt = `Query: "${query}"
Profile: ${profileInfo}

Is this person relevant to the query? Respond with JSON only:
{"include": true/false, "reason": "one sentence why (max 12 words)"}`;

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4-1-fast",
        messages: [
          { role: "system", content: "Respond only with valid JSON. Be strict - only include genuinely relevant results." },
          { role: "user", content: prompt }
        ],
        max_tokens: 80,
        temperature: 0.2,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    // Parse JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

// Verify profiles with Grok - PARALLEL verification for speed
async function verifyProfilesWithGrok(
  query: string,
  profiles: any[]
): Promise<{ verified: any[]; }> {
  const apiKey = process.env.GROK_API_KEY;
  
  if (!apiKey || profiles.length === 0) {
    return { verified: profiles };
  }

  // Verify ALL profiles in parallel for maximum speed
  const verificationPromises = profiles.map(profile => 
    verifySingleProfile(query, profile, apiKey)
  );
  
  const results = await Promise.all(verificationPromises);
  
  // Filter and enhance profiles based on results
  const verified = profiles
    .map((profile, i) => {
      const result = results[i];
      if (result && result.include) {
        return {
          ...profile,
          grokReason: result.reason,
        };
      }
      return null;
    })
    .filter(Boolean);

  return { verified };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { query } = await request.json();
    
    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query);

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Search within user's 1st and 2nd degree network
    const { data: profiles, error } = await supabase.rpc('search_network_profiles', {
      user_id: session.user.x_user_id,
      query_embedding: queryEmbedding,
      match_threshold: 0.5,  // Lower threshold for better recall
      match_count: 20,
    });

    if (error) {
      console.error("Vector search error:", error);
      
      // Fallback to keyword search if vector search fails
      const { data: fallbackProfiles } = await supabase
        .from('x_profiles')
        .select('*')
        .or(`bio.ilike.%${query}%,name.ilike.%${query}%,summary.ilike.%${query}%`)
        .limit(20);
      
      return NextResponse.json({
        success: true,
        profiles: (fallbackProfiles || []).map(p => ({
          id: p.x_user_id,
          x_user_id: p.x_user_id,
          username: p.username,
          name: p.name,
          bio: p.bio,
          summary: p.summary,
          profile_image_url: p.profile_image_url,
          followers_count: p.followers_count,
          following_count: p.following_count,
          degree: 1,
          matchReason: "Keyword match in bio, name, or summary",
        })),
        fallback: true,
      });
    }

    // Take top 15 results for Grok verification
    const topProfiles = (profiles || []).slice(0, 15);
    
    // Verify with Grok
    const { verified } = await verifyProfilesWithGrok(query, topProfiles);
    
    // Format verified results
    const formattedProfiles = verified.map((p: any) => ({
      id: p.x_user_id,
      x_user_id: p.x_user_id,
      username: p.username,
      name: p.name,
      bio: p.bio,
      summary: p.summary,
      profile_image_url: p.profile_image_url,
      followers_count: p.followers_count,
      following_count: p.following_count,
      degree: p.degree,
      matchReason: p.grokReason || `${p.degree === 1 ? '1st' : '2nd'} degree connection`,
    }));

    return NextResponse.json({
      success: true,
      profiles: formattedProfiles,
      count: formattedProfiles.length,
      verified: true,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}

