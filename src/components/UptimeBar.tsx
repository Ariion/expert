import { UptimeChart, type DayPoint } from "./UptimeChart";
import { fmtDuration } from "@/lib/format";
import { DEFAULT_LOCALE, dict, type Locale } from "@/lib/i18n";

interface IncidentLike {
  title: string;
  impact: string;
  started_at: Date;
  resolved_at: Date | null;
}

/**
 * Prépare les 90 derniers jours pour le graphique.
 *
 * Les jours sans mesure sont comblés côté serveur : la série doit toujours
 * faire quatre-vingt-dix colonnes, sinon l'axe ment sur la période couverte.
 * `incidents` est la même liste déjà chargée pour l'historique en dessous —
 * aucune requête de plus — recoupée jour par jour pour que le survol du
 * graphique réponde directement à « c'était quoi, cet incident ? » au lieu
 * d'un simple compte.
 */
export function UptimeBar({
  days,
  incidents = [],
  locale = DEFAULT_LOCALE,
}: {
  days: { day: string; uptime_pct: number; incident_count: number }[];
  incidents?: IncidentLike[];
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

    // Un incident touche ce jour dès que son intervalle [début, fin] le
    // recoupe — un incident commencé la veille et résolu ce matin compte pour
    // les deux jours, exactement comme l'a vécu quiconque surveillait.
    const dayStart = new Date(key + "T00:00:00.000Z").getTime();
    const dayEnd = dayStart + 86400000;
    const dayIncidents = incidents.filter((inc) => {
      if (inc.impact === "maintenance") return false;
      const start = inc.started_at.getTime();
      const end = (inc.resolved_at ?? new Date()).getTime();
      return start < dayEnd && end >= dayStart;
    });

    const titles = [...new Set(dayIncidents.map((inc) => inc.title))];
    const incidentCount = row?.incident_count ?? dayIncidents.length;

    points.push({
      day: key,
      minutes,
      incidents: incidentCount,
      titles,
      missing: pct === null,
      label: dayFormat.format(date),
      detail:
        pct === null
          ? t.service.chartDayNone
          : minutes <= 0
            ? t.service.chartDayOk
            : t.service.chartDayDown(
                fmtDuration(new Date(0), new Date(minutes * 60_000), locale),
                incidentCount,
              ),
    });
  }

  return (
    <UptimeChart
      points={points}
      hint={t.service.chartHint}
      toLabelText={t.time.today}
      ranges={[
        { days: 7, label: t.service.chartRange7, from: t.service.chartFrom(7) },
        { days: 30, label: t.service.chartRange30, from: t.service.chartFrom(30) },
        { days: 90, label: t.service.chartRange90, from: t.service.chartFrom(90) },
      ]}
      defaultRangeDays={90}
      legend={[
        ["ok", t.service.uptimeLegendOk],
        ["warn", t.service.uptimeLegendWarn],
        ["bad", t.service.uptimeLegendBad],
        ["none", t.service.uptimeLegendNone],
      ]}
    />
  );
}
