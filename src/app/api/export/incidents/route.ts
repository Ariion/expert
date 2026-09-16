import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getExportIncidents } from "@/lib/queries";
import { toCsv } from "@/lib/csv";
import { planFor } from "@/lib/plans";
import { fmtDuration } from "@/lib/format";
import { href } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Export CSV de l'historique — fonctionnalité des plans payants.
 *
 * Réservée sans détour : un compte Free est renvoyé vers la page de tarifs
 * plutôt que de recevoir un fichier vide, qui laisserait croire à une panne.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  const locale = /^\/en(\/|$)/.test(new URL(req.url).searchParams.get("from") ?? "") ? "en" : "fr";
  if (!user) return NextResponse.redirect(new URL(href(locale, "/login"), req.url), 303);

  if (planFor(user.plan).id === "free") {
    return NextResponse.redirect(new URL(`${href(locale, "/pricing")}?need=export`, req.url), 303);
  }

  const rows = await getExportIncidents(user.id);
  const csv = toCsv(
    ["fournisseur", "slug", "categorie", "incident", "impact", "etat", "debut", "fin", "duree_minutes", "duree", "source"],
    rows.map((r) => [
      r.service_name,
      r.service_slug,
      r.category,
      r.title,
      r.impact,
      r.state,
      r.started_at,
      r.resolved_at,
      r.minutes,
      r.resolved_at ? fmtDuration(r.started_at, r.resolved_at) : "",
      r.url,
    ]),
  );

  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="upstream-status-incidents-${day}.csv"`,
      "cache-control": "no-store",
    },
  });
}
