import { NextResponse } from "next/server";
import { requireApiCaller } from "@/lib/apiroute";
import { getUserWatchlist } from "@/lib/queries";
import { isDown } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** État courant des fournisseurs surveillés par le compte. */
export async function GET(req: Request) {
  const auth = await requireApiCaller(req);
  if ("error" in auth) return auth.error;

  const watchlist = await getUserWatchlist(auth.caller.userId);
  return NextResponse.json(
    {
      retrieved_at: new Date().toISOString(),
      count: watchlist.length,
      down: watchlist.filter((s) => isDown(s.current_status)).length,
      services: watchlist.map((s) => ({
        slug: s.slug,
        name: s.name,
        category: s.category,
        status: s.current_status,
        down: isDown(s.current_status),
        since: s.current_status_since,
        last_incident_at: s.last_incident_at,
        incidents_90d: s.incident_count_90d,
        uptime_90d: s.uptime_90d,
        status_page_url: s.status_page_url,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
