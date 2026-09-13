import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/http";
import { runDispatch } from "@/lib/dispatch";
import { trackCron } from "@/lib/ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vide la file d'alertes toutes les 2 minutes. */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return new NextResponse("non autorisé", { status: 401 });
  const stats = await trackCron("dispatch", () => runDispatch(120, 10, Date.now() + 50_000));
  return NextResponse.json({ ok: true, ...stats });
}
