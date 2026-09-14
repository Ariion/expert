import { NextResponse } from "next/server";
import { APP_URL } from "@/lib/env";
import { adminConfigured, createAdminSession, verifyAdminPassword } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => new FormData());
  const password = String(form.get("password") ?? "");
  const url = new URL("/admin/login", APP_URL());

  if (!adminConfigured()) {
    url.searchParams.set("error", "unconfigured");
    return NextResponse.redirect(url, 303);
  }
  if (!verifyAdminPassword(password)) {
    url.searchParams.set("error", "wrong");
    return NextResponse.redirect(url, 303);
  }

  await createAdminSession();
  return NextResponse.redirect(new URL("/admin", APP_URL()), 303);
}
