import { NextRequest, NextResponse } from "next/server";
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

    // Call backend to trigger scraping (which happens automatically on login anyway)
    // This is a manual trigger for the "Start Indexing" button
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

    try {
      const response = await fetch(`${backendUrl}/api/scrape/posts/${user.username}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Backend returned ${response.status}`);
      }

      const data = await response.json();

      return NextResponse.json({
        success: true,
        message: "Post scraping started in background",
        username: user.username,
        ...data,
      });
    } catch (backendError) {
      console.error("Backend scraping error:", backendError);
      return NextResponse.json(
        {
          error: "Failed to trigger scraping",
          details: backendError instanceof Error ? backendError.message : String(backendError)
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Failed to trigger scraping:", error);
    return NextResponse.json(
      { error: "Failed to start scraping job" },
      { status: 500 }
    );
  }
}

