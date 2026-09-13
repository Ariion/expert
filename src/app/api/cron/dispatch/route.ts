import { NextResponse } from "next/server";
import { isAuthorizedCron, runCron } from "@/lib/http";
import { runDispatch } from "@/lib/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vide la file d'alertes, à chaque passage du collecteur. */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return new NextResponse("non autorisé", { status: 401 });
  return runCron("dispatch", () => runDispatch(120, 12, Date.now() + 25_000));
}
