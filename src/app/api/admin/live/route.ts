import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin";
import { getLiveVisitors } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ live: await getLiveVisitors() });
}
