import { DEFAULT_LOCALE, dict, type Locale } from "@/lib/i18n";

/**
 * Historique 90 jours. Rendu en pur HTML/CSS (aucune librairie de graphes) :
 * la page reste statique, légère et indexable.
 */
export function UptimeBar({
  days,
  locale = DEFAULT_LOCALE,
}: {
  days: { day: string; uptime_pct: number; incident_count: number }[];
  locale?: Locale;
}) {
  const t = dict(locale);

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
      <div className="uptime" role="img" aria-label={t.service.uptimeTitle}>
        {cols.map((c) => {
          const cls = c.pct === null ? "none" : c.pct >= 99.9 ? "" : c.pct >= 98 ? "warn" : "bad";
          const title =
            c.pct === null
              ? `${c.day} — ${t.time.noData}`
              : `${c.day} — ${c.pct.toFixed(2)} % (${t.time.incidentsCount(c.incidents)})`;
          return <i key={c.day} className={cls} title={title} />;
        })}
      </div>
      <div className="between dim" style={{ marginTop: 6 }}>
        <span>{t.time.ninetyDaysAgo}</span>
        <span>{t.time.today}</span>
      </div>
      {/* Sans légende, une barre de couleurs ne se lit pas : on devine que le
          rouge est mauvais, jamais ce qu'il mesure exactement. */}
      <div className="uptime-legend dim">
        <span><i className="key ok" />{t.service.uptimeLegendOk}</span>
        <span><i className="key warn" />{t.service.uptimeLegendWarn}</span>
        <span><i className="key bad" />{t.service.uptimeLegendBad}</span>
        <span><i className="key none" />{t.service.uptimeLegendNone}</span>
      </div>
    </div>
  );
}
