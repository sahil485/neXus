import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ user: null });
  }
  
  // Return session without sensitive data
  return NextResponse.json({
    user: session.user,
    expiresAt: session.expiresAt,
  });
}

