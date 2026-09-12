/**
 * Historique 90 jours. Rendu en pur HTML/CSS (aucune librairie de graphes) :
 * la page reste statique, légère et indexable.
 */
export function UptimeBar({
  days,
}: {
  days: { day: string; uptime_pct: number; incident_count: number }[];
}) {
  // On complète à gauche pour toujours afficher 90 colonnes, même service jeune.
  const byDay = new Map(days.map((d) => [d.day, d]));
  const cols: Array<{ day: string; pct: number | null; incidents: number }> = [];
  for (let i = 89; i >= 0; i--) {
    const key = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const row = byDay.get(key);
    cols.push({ day: key, pct: row ? Number(row.uptime_pct) : null, incidents: row?.incident_count ?? 0 });
  }

  return (
    <div>
      <div className="uptime" aria-hidden="false" role="img" aria-label="Disponibilité sur 90 jours">
        {cols.map((c) => {
          const cls =
            c.pct === null ? "none" : c.pct >= 99.9 ? "" : c.pct >= 98 ? "warn" : "bad";
          const title =
            c.pct === null
              ? `${c.day} — pas de donnée`
              : `${c.day} — ${c.pct.toFixed(2)} % (${c.incidents} incident(s))`;
          return <i key={c.day} className={cls} title={title} />;
        })}
      </div>
      <div className="between dim" style={{ marginTop: 6 }}>
        <span>il y a 90 jours</span>
        <span>aujourd&apos;hui</span>
      </div>
    </div>
  );
}
