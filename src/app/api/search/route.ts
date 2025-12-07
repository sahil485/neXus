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

    // Format and return results with degree info
    // Convert similarity to a more meaningful match quality label
    const getMatchQuality = (similarity: number) => {
      if (similarity >= 0.7) return "Excellent match";
      if (similarity >= 0.55) return "Strong match";
      if (similarity >= 0.45) return "Good match";
      if (similarity >= 0.35) return "Relevant";
      return "Related";
    };
    
    const formattedProfiles = (profiles || []).map((p: any) => ({
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
      matchReason: `${getMatchQuality(p.similarity)} • ${p.degree === 1 ? '1st' : '2nd'} degree`,
    }));

    return NextResponse.json({
      success: true,
      profiles: formattedProfiles,
      count: formattedProfiles.length,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}

