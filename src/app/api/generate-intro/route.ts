import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { profile, currentUser } = await request.json();
    
    if (!profile) {
      return NextResponse.json({ error: "Profile is required" }, { status: 400 });
    }

    const apiKey = process.env.GROK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Grok API not configured" }, { status: 500 });
    }

    const prompt = `You are helping ${currentUser?.name || "a user"} (@${currentUser?.username || "user"}) write a personalized Twitter/X DM to introduce themselves to someone in their network.

TARGET PERSON:
- Name: ${profile.name}
- Username: @${profile.username}
- Bio: ${profile.bio || "No bio available"}
- Connection: ${profile.degree === 1 ? "1st degree (direct follow)" : "2nd degree (friend of a friend)"}
${profile.aiReason ? `- Why they matched the search: ${profile.aiReason}` : ""}

WRITE A DM THAT:
1. Is warm, genuine, and NOT salesy or generic
2. References something specific about them (from their bio or what you know)
3. Explains why you want to connect (be specific, not vague)
4. Is concise - Twitter DMs should be short and punchy
5. Feels human, not AI-generated
6. Is under 280 characters if possible

DO NOT:
- Use excessive emojis (1-2 max)
- Sound like a LinkedIn recruiter
- Be overly formal
- Say "I came across your profile"
- Use generic phrases like "love your work"

Write ONLY the DM message, nothing else:`;

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4-1-fast",
        messages: [
          { role: "system", content: "You write authentic, personalized DM intros. Be concise and genuine. Output only the message text." },
          { role: "user", content: prompt }
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error("Grok API error:", response.status);
      return NextResponse.json({ error: "Failed to generate intro" }, { status: 500 });
    }

    const data = await response.json();
    const message = data.choices[0].message.content.trim();
    
    // Remove any quotes if Grok wrapped the message
    const cleanMessage = message.replace(/^["']|["']$/g, "").trim();

    return NextResponse.json({
      success: true,
      message: cleanMessage,
    });
  } catch (error) {
    console.error("Generate intro error:", error);
    return NextResponse.json({ error: "Failed to generate intro" }, { status: 500 });
  }
}

