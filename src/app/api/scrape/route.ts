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
    
    // Manual trigger for "Start Indexing" button
    // Step 1: Scrape posts for user's network
    // Step 2: Generate RAG embeddings from those posts
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

    try {
      // Step 1: Trigger post scraping
      const scrapeResponse = await fetch(`${backendUrl}/api/scrape/posts/${user.username}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!scrapeResponse.ok) {
        const errorData = await scrapeResponse.json().catch(() => ({}));
        throw new Error(errorData.detail || `Post scraping failed: ${scrapeResponse.status}`);
      }

      const scrapeData = await scrapeResponse.json();

      // Step 2: Generate RAG embeddings
      const ragResponse = await fetch(`${backendUrl}/api/rag/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x_user_id: user.x_user_id }),
      });

      if (!ragResponse.ok) {
        const errorData = await ragResponse.json().catch(() => ({}));
        throw new Error(errorData.detail || `RAG generation failed: ${ragResponse.status}`);
      }

      const ragData = await ragResponse.json();

      return NextResponse.json({
        success: true,
        message: "Post scraping and RAG embeddings completed",
        username: user.username,
        scraping: scrapeData,
        rag: ragData,
      });
    } catch (backendError) {
      console.error("Backend scraping/RAG error:", backendError);
      return NextResponse.json(
        {
          error: "Failed to trigger scraping or RAG generation",
          details: backendError instanceof Error ? backendError.message : String(backendError)
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error("Failed to trigger scraping:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start scraping job" },
      { status: 500 }
    );
  }
}

