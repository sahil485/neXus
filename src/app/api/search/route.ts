import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

// Generate embedding using Grok API (xAI)
async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GROK_API_KEY;
  
  if (!apiKey) {
    console.warn("GROK_API_KEY not set, using OpenAI as fallback");
    // Fallback to OpenAI embeddings if Grok not available
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
      }),
    });
    
    if (!response.ok) {
      throw new Error("Failed to generate embedding");
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  }

  // Use Grok API (xAI) for embeddings
  // Note: Update endpoint when xAI releases their embedding API
  // For now, using OpenAI as the standard
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });
  
  if (!response.ok) {
    throw new Error("Failed to generate embedding");
  }
  
  const data = await response.json();
  return data.data[0].embedding;
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

    // Perform vector similarity search using pgvector
    // Note: This requires the pgvector extension and embedding column in x_profiles
    const { data: profiles, error } = await supabase.rpc('search_profiles', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: 20,
    });

    if (error) {
      console.error("Vector search error:", error);
      
      // Fallback to keyword search if vector search fails
      const { data: fallbackProfiles } = await supabase
        .from('x_profiles')
        .select('*')
        .or(`bio.ilike.%${query}%,name.ilike.%${query}%`)
        .limit(20);
      
      return NextResponse.json({
        success: true,
        profiles: (fallbackProfiles || []).map(p => ({
          id: p.x_user_id,
          x_user_id: p.x_user_id,
          username: p.username,
          name: p.name,
          bio: p.bio,
          profile_image_url: p.profile_image_url,
          followers_count: p.followers_count,
          following_count: p.following_count,
          degree: 1, // Default degree
          matchReason: "Keyword match in bio or name",
        })),
        fallback: true,
      });
    }

    // Format and return results
    const formattedProfiles = (profiles || []).map((p: any) => ({
      id: p.x_user_id,
      x_user_id: p.x_user_id,
      username: p.username,
      name: p.name,
      bio: p.bio,
      profile_image_url: p.profile_image_url,
      followers_count: p.followers_count,
      following_count: p.following_count,
      degree: 1, // You can enhance this based on connections table
      matchReason: `${Math.round(p.similarity * 100)}% semantic match`,
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

