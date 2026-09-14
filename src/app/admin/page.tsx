import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/admin";
import { getDailySeries, getKpis, getLiveVisitors, getTopPages, getTopReferrers } from "@/lib/analytics";
import { AdminLive } from "@/components/AdminLive";
import { AdminVisitsChart, type VisitPoint } from "@/components/AdminVisitsChart";

export const dynamic = "force-dynamic";

function fmtDwell(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m} min ${s} s` : `${m} min`;
}

const DAY_LABEL = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/** En-tête + déconnexion, communs à l'état normal et à l'état en erreur. */
function AdminHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="between" style={{ marginBottom: 24 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 26 }}>Statistiques</h1>
        <p className="dim" style={{ margin: "4px 0 0" }}>{subtitle}</p>
      </div>
      <form method="POST" action="/api/admin/logout">
        <button type="submit" className="btn ghost sm">Se déconnecter</button>
      </form>
    </div>
  );
}

export default async function AdminPage() {
  if (!(await isAdminSession())) redirect("/admin/login");

  let data;
  try {
    const [live, kpis7, kpis30, series, topPages, topReferrers] = await Promise.all([
      getLiveVisitors(),
      getKpis(7),
      getKpis(30),
      getDailySeries(14),
      getTopPages(7, 10),
      getTopReferrers(7, 10),
    ]);
    data = { live, kpis7, kpis30, series, topPages, topReferrers };
  } catch (err) {
    // La cause la plus probable est une base pas encore migrée : la table
    // `page_views` n'existe que si `supabase/schema.sql` a été rejoué après
    // l'ajout de ce panneau. On le dit clairement plutôt que de laisser
    // Next.js afficher son écran d'erreur générique.
    return (
      <div className="wrap" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 640 }}>
        <AdminHeader subtitle="Impossible de charger les statistiques." />
        <div className="notice bad">
          <strong>La base de données ne répond pas comme attendu.</strong>
          <p style={{ margin: "8px 0 0", fontSize: 13.5 }}>
            Cause la plus probable : la table <code>page_views</code> n'existe pas encore.
            Rejouez le schéma une fois : <code>psql "$DATABASE_URL" -f supabase/schema.sql</code>{" "}
            (fichier idempotent — sans risque sur le reste des données), puis rechargez cette page.
          </p>
          <p className="dim mono" style={{ margin: "10px 0 0", fontSize: 12 }}>
            {String(err instanceof Error ? err.message : err).slice(0, 300)}
          </p>
        </div>
      </div>
    );
  }

  const { live, kpis7, kpis30, series, topPages, topReferrers } = data;

  const points: VisitPoint[] = series.map((d) => ({
    day: d.day,
    views: d.views,
    visitors: d.visitors,
    label: DAY_LABEL.format(new Date(`${d.day}T12:00:00Z`)),
  }));

  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <AdminHeader subtitle="Visites anonymes, sans cookie — aucune adresse IP conservée." />

      <div className="grid four" style={{ marginBottom: 26 }}>
        <AdminLive initial={live} />
        <div className="card">
          <div className="dim" style={{ fontSize: 12.5, marginBottom: 6 }}>VUES (7 J)</div>
          <strong style={{ fontSize: 30, lineHeight: 1 }}>{kpis7.views}</strong>
        </div>
        <div className="card">
          <div className="dim" style={{ fontSize: 12.5, marginBottom: 6 }}>VISITEURS (7 J)</div>
          <strong style={{ fontSize: 30, lineHeight: 1 }}>{kpis7.visitors}</strong>
        </div>
        <div className="card">
          <div className="dim" style={{ fontSize: 12.5, marginBottom: 6 }}>TEMPS MOYEN</div>
          <strong style={{ fontSize: 30, lineHeight: 1 }}>{fmtDwell(kpis7.avgSeconds)}</strong>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 26 }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 16 }}>Visites — 14 derniers jours</h2>
        <AdminVisitsChart points={points} />
      </div>

      <div className="grid two">
        <div className="card">
          <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Pages les plus vues (7 j)</h2>
          {topPages.length === 0 ? (
            <p className="dim">Aucune donnée pour l'instant.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Vues</th>
                  <th>Visiteurs</th>
                </tr>
              </thead>
              <tbody>
                {topPages.map((row) => (
                  <tr key={row.key}>
                    <td className="mono">{row.key}</td>
                    <td>{row.views}</td>
                    <td>{row.visitors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Provenance (7 j)</h2>
          {topReferrers.length === 0 ? (
            <p className="dim">Aucun référent externe pour l'instant — trafic direct uniquement.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Vues</th>
                  <th>Visiteurs</th>
                </tr>
              </thead>
              <tbody>
                {topReferrers.map((row) => (
                  <tr key={row.key}>
                    <td>{row.key}</td>
                    <td>{row.views}</td>
                    <td>{row.visitors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <p className="dim" style={{ marginTop: 26, fontSize: 12.5 }}>
        30 jours : {kpis30.views} vues · {kpis30.visitors} visiteurs · rebond {kpis30.bounceRate}%.
      </p>
    </div>
  );
}
