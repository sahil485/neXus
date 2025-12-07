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

// Verify a single profile with Grok (ultra fast)
async function verifySingleProfile(
  query: string,
  profile: any,
  apiKey: string
): Promise<{ include: boolean; reason: string } | null> {
  const bio = (profile.summary || profile.bio || "").slice(0, 200);
  
  const prompt = `You are verifying if a person matches a search query. Be STRICT - only return match:true if they genuinely fit what the user is looking for.

SEARCH QUERY: "${query}"

PERSON: ${profile.name} (@${profile.username})
BIO: ${bio}

EVALUATE:
Is there clear evidence in their bio that they fit the query and they are relevant to the search query?


RESPOND with JSON only:
- If they ARE a good match: {"match":true,"why":"[specific 10-word reason citing their actual role/expertise]"}
- If they are NOT a match: {"match":false,"why":""}

JSON:`;

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4-1-fast",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 80,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.log("Grok error:", response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    console.log("Grok:", profile.username, "->", content);
    
    // Parse JSON
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      include: parsed.match ?? parsed.include ?? true,
      reason: parsed.why || parsed.reason || ""
    };
  } catch (e) {
    console.log("Grok error:", e);
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
    // No API key - return all profiles without verification
    return { verified: profiles.map(p => ({ ...p, grokReason: null })) };
  }

  // Verify ALL profiles in parallel for maximum speed
  const verificationPromises = profiles.map(profile => 
    verifySingleProfile(query, profile, apiKey)
  );
  
  const results = await Promise.all(verificationPromises);
  
  // Enhanced profiles - INCLUDE if verification passes OR if verification failed (null)
  // Only EXCLUDE if Grok explicitly says include: false
  const verified = profiles
    .map((profile, i) => {
      const result = results[i];
      
      // If verification failed (null), include profile anyway with no reason
      if (result === null) {
        return { ...profile, grokReason: null };
      }
      
      // If Grok says include, add the reason
      if (result.include) {
        return { ...profile, grokReason: result.reason };
      }
      
      // Only exclude if Grok explicitly says include: false
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

    const { query, stream } = await request.json();
    
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
      match_threshold: 0.3,
      match_count: 20,
    });

    if (error) {
      console.error("Vector search error:", error);
      return NextResponse.json({ success: false, profiles: [], error: error.message });
    }

    const topProfiles = (profiles || []).slice(0, 10);
    
    if (topProfiles.length === 0) {
      return NextResponse.json({ success: true, profiles: [], count: 0 });
    }

    // Helper to get match level from similarity score
    const getMatchLevel = (similarity: number) => {
      if (similarity >= 0.6) return "Excellent";
      if (similarity >= 0.45) return "Strong";
      if (similarity >= 0.35) return "Good";
      return "Related";
    };

    // If streaming requested, use SSE
    if (stream) {
      const encoder = new TextEncoder();
      const apiKey = process.env.GROK_API_KEY;
      
      const readableStream = new ReadableStream({
        async start(controller) {
          // Send all profiles immediately (unverified)
          for (const profile of topProfiles) {
            const formatted = {
              id: profile.x_user_id,
              x_user_id: profile.x_user_id,
              username: profile.username,
              name: profile.name,
              bio: profile.bio,
              summary: profile.summary,
              profile_image_url: profile.profile_image_url,
              followers_count: profile.followers_count,
              following_count: profile.following_count,
              degree: profile.degree,
              matchLevel: getMatchLevel(profile.similarity),
              aiReason: null,
              verifying: true,
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'profile', profile: formatted })}\n\n`));
          }
          
          // Now verify each profile and send updates
          if (apiKey) {
            const verifyPromises = topProfiles.map(async (profile) => {
              const result = await verifySingleProfile(query, profile, apiKey);
              
              if (result === null || result.include) {
                // Include - send update with reason
                // Use Grok reason if available, otherwise generate from bio
                let aiReason = result?.reason;
                if (!aiReason || aiReason.length < 5) {
                  const bio = profile.summary || profile.bio || "";
                  const firstSentence = bio.split(/[.!?]/)[0].trim();
                  aiReason = firstSentence.length > 10 ? firstSentence : `Matches "${query}" in your network`;
                }
                const updated = {
                  id: profile.x_user_id,
                  x_user_id: profile.x_user_id,
                  username: profile.username,
                  name: profile.name,
                  bio: profile.bio,
                  summary: profile.summary,
                  profile_image_url: profile.profile_image_url,
                  followers_count: profile.followers_count,
                  following_count: profile.following_count,
                  degree: profile.degree,
                  matchLevel: getMatchLevel(profile.similarity),
                  aiReason: aiReason,
                  verifying: false,
                  verified: true,
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'update', profile: updated })}\n\n`));
              } else {
                // Exclude - send remove signal
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'remove', id: profile.x_user_id })}\n\n`));
              }
            });
            
            await Promise.all(verifyPromises);
          }
          
          // Signal done
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        }
      });
      
      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming: wait for all verifications
    const verificationPromise = verifyProfilesWithGrok(query, topProfiles);
    const timeoutPromise = new Promise<{ verified: any[] }>((resolve) => 
      setTimeout(() => resolve({ verified: topProfiles.map(p => ({ ...p, grokReason: null })) }), 2000)
    );
    
    const { verified } = await Promise.race([verificationPromise, timeoutPromise]);
    
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
      matchLevel: getMatchLevel(p.similarity || 0.5),
      aiReason: p.grokReason || null,
      verifying: false,
    }));

    return NextResponse.json({
      success: true,
      profiles: formattedProfiles,
      count: formattedProfiles.length,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

