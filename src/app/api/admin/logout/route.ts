import { NextResponse } from "next/server";
import { APP_URL } from "@/lib/env";
import { destroyAdminSession } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await destroyAdminSession();
  return NextResponse.redirect(new URL("/admin/login", APP_URL()), 303);
}
