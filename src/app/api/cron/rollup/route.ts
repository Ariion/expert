import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/http";
import { rebuildUptime, sendDailyDigests } from "@/lib/rollup";
import { trackCron } from "@/lib/ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Agrégats de disponibilité + digests quotidiens (une fois par nuit). */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return new NextResponse("non autorisé", { status: 401 });

  const stats = await trackCron("rollup", async () => {
    const rows = await rebuildUptime(90);
    const digests = await sendDailyDigests();
    return { rows, digests };
  });

  return NextResponse.json({ ok: true, ...stats });
}
