import { NextResponse } from "next/server";
import { isAuthorizedCron, runCron, unauthorizedCron } from "@/lib/http";
import { rebuildUptime, sendDailyDigests } from "@/lib/rollup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Agrégats de disponibilité + digests quotidiens (une fois par nuit). */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return unauthorizedCron();

  return runCron("rollup", async () => {
    const rows = await rebuildUptime(90);
    const digests = await sendDailyDigests();
    return { rows, digests };
  });

}
