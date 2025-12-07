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

    // Call Python backend to generate RAG for user's 1st and 2nd degree connections
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    const response = await fetch(`${backendUrl}/api/rag/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        x_user_id: user.x_user_id,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Backend scraping failed");
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: "Scraping completed with RAG embeddings",
      ...data,
    });
  } catch (error) {
    console.error("Failed to trigger scraping:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start scraping job" },
      { status: 500 }
    );
  }
}

