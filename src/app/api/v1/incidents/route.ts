import { NextResponse } from "next/server";
import { intParam, requireApiCaller } from "@/lib/apiroute";
import { getExportIncidents } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Historique des incidents des fournisseurs surveillés. `?days=` borné à un an. */
export async function GET(req: Request) {
  const auth = await requireApiCaller(req);
  if ("error" in auth) return auth.error;

  const days = intParam(req, "days", 90, 1, 365);
  const limit = intParam(req, "limit", 200, 1, 1000);
  const rows = await getExportIncidents(auth.caller.userId, days);

  return NextResponse.json(
    {
      retrieved_at: new Date().toISOString(),
      days,
      count: Math.min(rows.length, limit),
      incidents: rows.slice(0, limit).map((r) => ({
        service: { slug: r.service_slug, name: r.service_name, category: r.category },
        title: r.title,
        impact: r.impact,
        state: r.state,
        started_at: r.started_at,
        resolved_at: r.resolved_at,
        duration_minutes: r.minutes,
        url: r.url,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
