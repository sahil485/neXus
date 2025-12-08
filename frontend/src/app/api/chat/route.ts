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

// Call Grok for chat responses
async function callGrok(
  message: string,
  context: string,
  history: { role: string; content: string }[]
): Promise<string> {
  const apiKey = process.env.GROK_API_KEY;

  if (!apiKey) {
    throw new Error("GROK_API_KEY not configured");
  }

  const systemPrompt = `You are a helpful network assistant for a professional networking app called neXus. You help users discover people in their Twitter/X network.

You have access to the user's 1st and 2nd degree connections. When users ask about finding people, you should:
1. Understand what kind of person they're looking for
2. Suggest relevant profiles from their network
3. Provide helpful context about why these people might be relevant

${context ? `Here are some relevant profiles from the user's network:\n${context}` : ""}

Be conversational, helpful, and concise. If you find relevant profiles, mention them naturally in your response.
Don't just list profiles - provide context about why they might be interesting to connect with.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-6),
    { role: "user", content: message },
  ];

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-4-1-fast",
      messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Grok API error:", error);
    throw new Error(`Failed to get Grok response: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message, history = [] } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Check if this is a search-like query
    const searchKeywords = [
      "find",
      "search",
      "looking for",
      "who",
      "anyone",
      "people",
      "know",
      "connect",
      "introduce",
      "works",
      "researcher",
      "founder",
      "engineer",
      "developer",
      "designer",
      "investor",
    ];

    const isSearchQuery = searchKeywords.some((keyword) =>
      message.toLowerCase().includes(keyword)
    );

    let profiles: any[] = [];
    let context = "";

    if (isSearchQuery) {
      try {
        // Generate embedding for the message
        const queryEmbedding = await generateEmbedding(message);

        // Search for relevant profiles
        const { data: searchResults, error } = await supabase.rpc(
          "search_network_profiles",
          {
            user_id: session.user.x_user_id,
            query_embedding: queryEmbedding,
            match_threshold: 0.4,
            match_count: 10,
          }
        );

        if (!error && searchResults && searchResults.length > 0) {
          profiles = searchResults;

          // Build context for Grok
          context = profiles
            .slice(0, 5)
            .map(
              (p: any) =>
                `- ${p.name} (@${p.username}): ${p.summary || p.bio || "No bio"} [${p.degree === 1 ? "1st" : "2nd"} degree connection]`
            )
            .join("\n");
        }
      } catch (searchError) {
        console.error("Search error:", searchError);
        // Continue without profiles
      }
    }

    // Get response from Grok
    const response = await callGrok(message, context, history);

    return NextResponse.json({
      success: true,
      response,
      profiles: profiles.slice(0, 5),
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}

