import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function GET() {
  await clearSession();
  return NextResponse.redirect(
    new URL("/", process.env.NEXTAUTH_URL || "http://localhost:3000")
  );
}

export async function POST() {
  await clearSession();
  return NextResponse.json({ success: true });
}

