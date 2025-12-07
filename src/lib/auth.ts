import { cookies } from "next/headers";

// X OAuth 2.0 Configuration
export const X_AUTH_CONFIG = {
  clientId: process.env.TWITTER_CLIENT_ID!,
  clientSecret: process.env.TWITTER_CLIENT_SECRET!,
  redirectUri: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/auth/x/callback`,
  authorizationEndpoint: "https://twitter.com/i/oauth2/authorize",
  tokenEndpoint: "https://api.twitter.com/2/oauth2/token",
  userInfoEndpoint: "https://api.twitter.com/2/users/me",
  scopes: ["tweet.read", "users.read", "follows.read", "offline.access"],
};

// Generate PKCE code verifier and challenge
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64URLEncode(new Uint8Array(digest));
}

function base64URLEncode(buffer: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// Generate state for CSRF protection
export function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

// Build authorization URL
export async function buildAuthorizationUrl(): Promise<{
  url: string;
  state: string;
  codeVerifier: string;
}> {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: X_AUTH_CONFIG.clientId,
    redirect_uri: X_AUTH_CONFIG.redirectUri,
    scope: X_AUTH_CONFIG.scopes.join(" "),
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return {
    url: `${X_AUTH_CONFIG.authorizationEndpoint}?${params.toString()}`,
    state,
    codeVerifier,
  };
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}> {
  const credentials = Buffer.from(
    `${X_AUTH_CONFIG.clientId}:${X_AUTH_CONFIG.clientSecret}`
  ).toString("base64");

  const response = await fetch(X_AUTH_CONFIG.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: X_AUTH_CONFIG.redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

// Get user info from X API
export async function getXUserInfo(accessToken: string): Promise<{
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
  description?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}> {
  const response = await fetch(
    `${X_AUTH_CONFIG.userInfoEndpoint}?user.fields=id,name,username,profile_image_url,description,public_metrics`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get user info: ${error}`);
  }

  const data = await response.json();
  return data.data;
}

// Session types
export interface XUser {
  id: string;
  x_user_id: string;
  username: string;
  name: string;
  profile_image_url?: string;
  bio?: string;
  followers_count?: number;
  following_count?: number;
}

export interface Session {
  user: XUser;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

// Cookie-based session management
const SESSION_COOKIE = "nexus_session";
const AUTH_STATE_COOKIE = "nexus_auth_state";
const CODE_VERIFIER_COOKIE = "nexus_code_verifier";

export async function setAuthCookies(state: string, codeVerifier: string) {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";
  
  // Use 'none' for cross-site OAuth redirects in production (requires secure)
  // Use 'lax' for development
  const sameSite = isProduction ? "none" : "lax";
  
  cookieStore.set(AUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });
  
  cookieStore.set(CODE_VERIFIER_COOKIE, codeVerifier, {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });
}

export async function getAuthCookies(): Promise<{
  state: string | undefined;
  codeVerifier: string | undefined;
}> {
  const cookieStore = await cookies();
  return {
    state: cookieStore.get(AUTH_STATE_COOKIE)?.value,
    codeVerifier: cookieStore.get(CODE_VERIFIER_COOKIE)?.value,
  };
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_STATE_COOKIE);
  cookieStore.delete(CODE_VERIFIER_COOKIE);
}

export async function setSession(session: Session) {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";
  
  cookieStore.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);
  
  if (!sessionCookie?.value) {
    return null;
  }
  
  try {
    const session = JSON.parse(sessionCookie.value) as Session;
    
    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      await clearSession();
      return null;
    }
    
    return session;
  } catch {
    return null;
  }
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

