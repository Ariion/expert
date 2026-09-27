import { NextResponse } from "next/server";
import { isAuthorizedCron, runCron, unauthorizedCron } from "@/lib/http";
import { rebuildUptime, sendDailyDigests, sendMonthlySlaReports } from "@/lib/rollup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Agrégats de disponibilité + digests quotidiens (une fois par nuit). */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return unauthorizedCron();

  return runCron("rollup", async () => {
    const rows = await rebuildUptime(90);
    const digests = await sendDailyDigests();
    // Ne fait quelque chose qu'une fois par mois : la garde vit dans la
    // requête, pas dans une condition de date ici, pour qu'un jour manqué
    // (panne de la tâche le 1er) soit rattrapé le lendemain.
    const slaReports = await sendMonthlySlaReports();
    return { rows, digests, slaReports };
  });

}
