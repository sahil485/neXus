import { NextRequest, NextResponse } from "next/server";
import {
  getAuthCookies,
  clearAuthCookies,
  exchangeCodeForTokens,
  getXUserInfo,
  setSession,
  type Session,
} from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth errors
    if (error) {
      console.error("OAuth error:", error);
      return NextResponse.redirect(
        new URL(`/?error=${error}`, process.env.NEXTAUTH_URL || "http://localhost:3000")
      );
    }

    // Validate required params
    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/?error=missing_params", process.env.NEXTAUTH_URL || "http://localhost:3000")
      );
    }

    // Get stored auth cookies
    const { state: storedState, codeVerifier } = await getAuthCookies();

    // Verify state matches to prevent CSRF
    if (state !== storedState) {
      return NextResponse.redirect(
        new URL("/?error=state_mismatch", process.env.NEXTAUTH_URL || "http://localhost:3000")
      );
    }

    if (!codeVerifier) {
      return NextResponse.redirect(
        new URL("/?error=missing_verifier", process.env.NEXTAUTH_URL || "http://localhost:3000")
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, codeVerifier);

    // Get user info from X API
    const userInfo = await getXUserInfo(tokens.access_token);

    // Create session
    const session: Session = {
      user: {
        id: userInfo.id,
        x_user_id: userInfo.id,
        username: userInfo.username,
        name: userInfo.name,
        profile_image_url: userInfo.profile_image_url,
        bio: userInfo.description,
        followers_count: userInfo.public_metrics?.followers_count,
        following_count: userInfo.public_metrics?.following_count,
      },
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    };

    // Store session
    await setSession(session);

    // Clear auth cookies
    await clearAuthCookies();

    // Redirect to dashboard
    return NextResponse.redirect(
      new URL("/dashboard", process.env.NEXTAUTH_URL || "http://localhost:3000")
    );
  } catch (error) {
    console.error("Callback error:", error);
    return NextResponse.redirect(
      new URL("/?error=callback_failed", process.env.NEXTAUTH_URL || "http://localhost:3000")
    );
  }
}

