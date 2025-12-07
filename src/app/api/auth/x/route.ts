import { NextResponse } from "next/server";
import { buildAuthorizationUrl, setAuthCookies } from "@/lib/auth";

export async function GET() {
  try {
    // Check if environment variables are configured
    if (!process.env.TWITTER_CLIENT_ID) {
      // For development without credentials, redirect to demo mode
      return NextResponse.redirect(
        new URL("/dashboard?demo=true", process.env.NEXTAUTH_URL || "http://localhost:3000")
      );
    }

    // Build the authorization URL with PKCE
    const { url, state, codeVerifier } = await buildAuthorizationUrl();

    // Store state and code verifier in cookies for verification
    await setAuthCookies(state, codeVerifier);

    // Redirect to X authorization page
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Auth initiation error:", error);
    return NextResponse.redirect(
      new URL("/?error=auth_failed", process.env.NEXTAUTH_URL || "http://localhost:3000")
    );
  }
}

