import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("target");

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Target user ID required" },
        { status: 400 }
      );
    }

    // Call backend API to find bridge profile
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    const response = await fetch(`${backendUrl}/api/network/bridge/${session.user.x_user_id}/${targetUserId}`, {
      headers: {
        "Authorization": `Bearer ${process.env.BEARER_TOKEN || ""}`,
      },
    });

    if (!response.ok) {
      console.error("Backend bridge API failed:", response.status);
      return NextResponse.json({ bridge: null });
    }

    const data = await response.json();

    if (!data.bridge) {
      return NextResponse.json({ bridge: null });
    }

    // Return the bridge profile
    return NextResponse.json({
      bridge: {
        id: data.bridge.x_user_id,
        x_user_id: data.bridge.x_user_id,
        username: data.bridge.username,
        name: data.bridge.name,
        bio: data.bridge.bio || "",
        profile_image_url: data.bridge.profile_image_url,
        followers_count: data.bridge.followers_count || 0,
        following_count: data.bridge.following_count || 0,
        degree: 1,
      }
    });
  } catch (error) {
    console.error("Bridge profile fetch error:", error);
    return NextResponse.json({ bridge: null });
  }
}
