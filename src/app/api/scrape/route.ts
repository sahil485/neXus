import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // Get the current user's session
    const session = await getSession();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { user } = session;

    // Trigger the background scraping job
    await inngest.send({
      name: "scrape/network.requested",
      data: {
        userId: user.x_user_id,
        username: user.username,
        accessToken: session.accessToken,
        // Note: Twitter API v2 OAuth 2.0 doesn't use accessSecret
        // You might need to adjust based on your OAuth implementation
        accessSecret: "", // Leave empty for OAuth 2.0
      },
    });

    return NextResponse.json({
      success: true,
      message: "Scraping job started in background",
      username: user.username,
    });
  } catch (error) {
    console.error("Failed to trigger scraping:", error);
    return NextResponse.json(
      { error: "Failed to start scraping job" },
      { status: 500 }
    );
  }
}

