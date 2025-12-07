import { NextRequest, NextResponse } from "next/server";
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
    // Simple auth check - you might want to add admin-only auth
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.NEXTAUTH_SECRET}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Get profiles that need embeddings
    const { data: profiles, error: fetchError } = await supabase
      .rpc('get_profiles_needing_embeddings', { batch_size: 50 });

    if (fetchError) {
      console.error("Error fetching profiles:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch profiles" },
        { status: 500 }
      );
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No profiles need embeddings",
        processed: 0,
      });
    }

    let processed = 0;
    let errors = 0;

    // Process each profile
    for (const profile of profiles) {
      try {
        // Combine profile information into searchable text
        const searchText = [
          profile.name,
          profile.username,
          profile.bio || "",
        ].filter(Boolean).join(" ");

        // Generate embedding
        const embedding = await generateEmbedding(searchText);

        // Store embedding in database
        const { error: updateError } = await supabase
          .from('x_profiles')
          .update({ embedding })
          .eq('x_user_id', profile.x_user_id);

        if (updateError) {
          console.error(`Error updating profile ${profile.x_user_id}:`, updateError);
          errors++;
        } else {
          processed++;
        }

        // Rate limiting - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing profile ${profile.x_user_id}:`, error);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      errors,
      total: profiles.length,
    });
  } catch (error) {
    console.error("Embedding generation error:", error);
    return NextResponse.json(
      { error: "Embedding generation failed" },
      { status: 500 }
    );
  }
}

// GET endpoint to check status
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Count profiles with and without embeddings
    const { count: totalCount } = await supabase
      .from('x_profiles')
      .select('*', { count: 'exact', head: true });

    const { count: embeddedCount } = await supabase
      .from('x_profiles')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);

    const needEmbedding = (totalCount || 0) - (embeddedCount || 0);

    return NextResponse.json({
      total: totalCount || 0,
      embedded: embeddedCount || 0,
      needEmbedding,
      progress: totalCount ? ((embeddedCount || 0) / totalCount * 100).toFixed(1) + '%' : '0%',
    });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 }
    );
  }
}

