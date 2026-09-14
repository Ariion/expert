import { UptimeChart, type DayPoint } from "./UptimeChart";
import { fmtDuration } from "@/lib/format";
import { DEFAULT_LOCALE, dict, type Locale } from "@/lib/i18n";

/**
 * Prépare les 90 derniers jours pour le graphique.
 *
 * Les jours sans mesure sont comblés côté serveur : la série doit toujours
 * faire quatre-vingt-dix colonnes, sinon l'axe ment sur la période couverte.
 * Tout le calcul est fait ici pour que le composant interactif ne reçoive que
 * des chaînes déjà traduites et formatées.
 */
export function UptimeBar({
  days,
  locale = DEFAULT_LOCALE,
}: {
  days: { day: string; uptime_pct: number; incident_count: number }[];
  locale?: Locale;
}) {
  const t = dict(locale);
  const byDay = new Map(days.map((d) => [d.day, d]));

  const dayFormat = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const points: DayPoint[] = [];
  for (let i = 89; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    const key = date.toISOString().slice(0, 10);
    const row = byDay.get(key);
    const pct = row ? Number(row.uptime_pct) : null;
    const minutes = pct === null ? 0 : Math.round(((100 - pct) / 100) * 1440);
    const incidents = row?.incident_count ?? 0;

    points.push({
      day: key,
      minutes,
      incidents,
      missing: pct === null,
      label: dayFormat.format(date),
      detail:
        pct === null
          ? t.service.chartDayNone
          : minutes <= 0
            ? t.service.chartDayOk
            : t.service.chartDayDown(
                fmtDuration(new Date(0), new Date(minutes * 60_000), locale),
                incidents,
              ),
    });
  }

  return (
    <UptimeChart
      points={points}
      hint={t.service.chartHint}
      fromLabel={t.time.ninetyDaysAgo}
      toLabel={t.time.today}
      legend={[
        ["ok", t.service.uptimeLegendOk],
        ["warn", t.service.uptimeLegendWarn],
        ["bad", t.service.uptimeLegendBad],
        ["none", t.service.uptimeLegendNone],
      ]}
    />
  );
}
