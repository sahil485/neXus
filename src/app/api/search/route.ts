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

// Verify profiles with Grok - batch verification
async function verifyProfilesWithGrok(
  query: string,
  profiles: any[]
): Promise<{ verified: any[]; }> {
  const apiKey = process.env.GROK_API_KEY;
  
  if (!apiKey || profiles.length === 0) {
    return { verified: profiles };
  }

  // Build profile summaries for Grok
  const profileSummaries = profiles.map((p, i) => 
    `[${i + 1}] ${p.name} (@${p.username}): ${p.summary || p.bio || "No bio available"}`
  ).join("\n\n");

  const prompt = `You are verifying search results for the query: "${query}"

Here are the candidate profiles:
${profileSummaries}

For EACH profile, respond with a JSON array. For each profile include:
- "index": the profile number (1-based)
- "include": true if this person is relevant to the query, false if not
- "reason": ONE sentence (max 15 words) explaining why they match the query. Be specific about their relevance.

Only include profiles that are genuinely relevant. Be strict but fair.

Respond ONLY with valid JSON array, no other text:
[{"index": 1, "include": true, "reason": "..."}, ...]`;

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
          { role: "system", content: "You are a search result verification assistant. Respond only with valid JSON." },
          { role: "user", content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error("Grok verification failed:", await response.text());
      return { verified: profiles };
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    // Parse JSON response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("Could not parse Grok response:", content);
      return { verified: profiles };
    }

    const verifications = JSON.parse(jsonMatch[0]);
    
    // Filter and enhance profiles based on Grok's response
    const verified = profiles
      .map((profile, i) => {
        const verification = verifications.find((v: any) => v.index === i + 1);
        if (verification && verification.include) {
          return {
            ...profile,
            grokReason: verification.reason,
          };
        }
        return null;
      })
      .filter(Boolean);

    return { verified };
  } catch (error) {
    console.error("Grok verification error:", error);
    return { verified: profiles };
  }
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

