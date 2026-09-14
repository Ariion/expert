"use client";

import { useState } from "react";

export interface DayPoint {
  day: string;
  /** Minutes d'indisponibilité ce jour-là. */
  minutes: number;
  incidents: number;
  /** Titres des incidents ouverts ce jour-là — ce qu'on cherche en survolant. */
  titles: string[];
  /** Aucune donnée collectée ce jour-là. */
  missing: boolean;
  label: string;
  detail: string;
}

/**
 * Quatre-vingt-dix jours d'incidents.
 *
 * La version précédente traçait la disponibilité : entre 99,9 % et 100 %, tous
 * les jours se ressemblent, et le graphique ne montrait rien. Celui-ci trace
 * l'inverse — le temps d'indisponibilité — de sorte qu'un jour calme est une
 * ligne de base et qu'une panne est un pic qu'on ne peut pas rater.
 *
 * L'échelle est en racine carrée : une coupure de dix minutes reste visible à
 * côté d'une panne de six heures, alors qu'une échelle linéaire l'écraserait
 * contre le zéro.
 */
const MAX_MINUTES = 24 * 60;

function height(minutes: number): number {
  if (minutes <= 0) return 18;
  const ratio = Math.min(minutes, MAX_MINUTES) / MAX_MINUTES;
  return 22 + Math.sqrt(ratio) * 78;
}

function tone(point: DayPoint): string {
  if (point.missing) return "none";
  if (point.minutes <= 0) return "ok";
  return point.minutes >= 60 ? "bad" : "warn";
}

export interface RangeOption {
  days: number;
  label: string;
  /** Texte « il y a N jours » pour cette plage — calculé côté serveur : une
      fonction ne peut pas traverser la frontière serveur/client en prop. */
  from: string;
}

export function UptimeChart({
  points,
  legend,
  toLabelText,
  hint,
  ranges,
  defaultRangeDays,
}: {
  /** Toujours la plage maximale (90 jours) : les plages plus courtes en sont extraites. */
  points: DayPoint[];
  legend: Array<[string, string]>;
  toLabelText: string;
  hint: string;
  ranges: RangeOption[];
  defaultRangeDays: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [rangeDays, setRangeDays] = useState(defaultRangeDays);

  // La plage sélectionnée n'est jamais une nouvelle requête : on ne fait que
  // recadrer la série déjà chargée sur ses derniers N jours.
  const visible = points.slice(Math.max(0, points.length - rangeDays));
  const shown = active !== null ? visible[active] : null;

  const changeRange = (days: number) => {
    setRangeDays(days);
    setActive(null);
  };

  return (
    <div className="chart">
      {ranges.length > 1 && (
        <div className="chart-range" role="group">
          {ranges.map((r) => (
            <button
              type="button"
              key={r.days}
              className={rangeDays === r.days ? "on" : ""}
              onClick={() => changeRange(r.days)}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {/* Un emplacement réservé en permanence : sans lui, la lecture du
          graphique déplacerait tout ce qui se trouve en dessous. */}
      <div className="chart-readout" aria-live="polite">
        {shown ? (
          <>
            <strong>{shown.label}</strong>
            <span className="dim">{shown.detail}</span>
            {shown.titles.length > 0 && (
              <span className="chart-titles">
                {shown.titles.slice(0, 3).map((title) => (
                  <span key={title} className="chart-title-pill">
                    {title}
                  </span>
                ))}
                {shown.titles.length > 3 && <span className="dim">+{shown.titles.length - 3}</span>}
              </span>
            )}
          </>
        ) : (
          <span className="dim">{hint}</span>
        )}
      </div>

      <div className="chart-bars" onMouseLeave={() => setActive(null)}>
        {visible.map((p, i) => (
          <button
            type="button"
            key={p.day}
            className={`chart-col ${tone(p)} ${active === i ? "on" : ""}`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(active === i ? null : i)}
            aria-label={`${p.label} — ${p.detail}`}
          >
            <i style={{ height: `${height(p.minutes)}%` }} />
          </button>
        ))}
      </div>

      <div className="between dim chart-axis">
        <span>{ranges.find((r) => r.days === rangeDays)?.from}</span>
        <span>{toLabelText}</span>
      </div>

      <div className="uptime-legend dim">
        {legend.map(([cls, text]) => (
          <span key={cls}>
            <i className={`key ${cls}`} />
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
