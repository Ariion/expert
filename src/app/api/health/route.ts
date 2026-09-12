import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sonde publique légère — branchable sur un moniteur externe (UptimeRobot,
 * Better Stack…). C'est le dernier filet : il surveille le surveillant.
 */
export async function GET() {
  try {
    const [row] = await sql<{ services: number; last_ingest: Date | null; pending: number }[]>`
      select (select count(*)::int from services where is_active) as services,
             (select max(finished_at) from cron_runs where job = 'ingest' and ok) as last_ingest,
             (select count(*)::int from alert_deliveries where status = 'pending') as pending
    `;
    const staleMs = row.last_ingest ? Date.now() - new Date(row.last_ingest).getTime() : Infinity;
    const healthy = staleMs < 45 * 60_000;

    return NextResponse.json(
      {
        status: healthy ? "ok" : "degraded",
        services: row.services,
        last_ingest: row.last_ingest,
        pending_alerts: row.pending,
      },
      { status: healthy ? 200 : 503 },
    );
  } catch (err) {
    return NextResponse.json({ status: "down", error: String(err) }, { status: 503 });
  }
}
