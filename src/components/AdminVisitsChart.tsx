"use client";

import { useState } from "react";

export interface VisitPoint {
  day: string; // YYYY-MM-DD
  views: number;
  visitors: number;
  label: string; // "14 sept."
}

/**
 * Visites par jour — magnitude simple, donc une seule teinte (séquentielle),
 * échelle linéaire : contrairement au graphique de pannes, il n'y a pas ici
 * de valeur extrême à comprimer.
 */
function height(views: number, max: number): number {
  if (max <= 0) return 4;
  return 6 + (views / max) * 94;
}

export function AdminVisitsChart({ points }: { points: VisitPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.views));
  const shown = active !== null ? points[active] : null;

  return (
    <div className="chart">
      <div className="chart-readout" aria-live="polite">
        {shown ? (
          <>
            <strong>{shown.label}</strong>
            <span className="dim">
              {shown.views} vue{shown.views !== 1 ? "s" : ""} · {shown.visitors} visiteur
              {shown.visitors !== 1 ? "s" : ""}
            </span>
          </>
        ) : (
          <span className="dim">Survolez une barre pour le détail du jour.</span>
        )}
      </div>

      <div className="chart-bars" onMouseLeave={() => setActive(null)}>
        {points.map((p, i) => (
          <button
            type="button"
            key={p.day}
            className={`chart-col magnitude ${active === i ? "on" : ""}`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(active === i ? null : i)}
            aria-label={`${p.label} — ${p.views} vues, ${p.visitors} visiteurs`}
          >
            <i style={{ height: `${height(p.views, max)}%` }} />
          </button>
        ))}
      </div>

      <div className="between dim chart-axis">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>

      <details style={{ marginTop: 14 }}>
        <summary className="dim" style={{ cursor: "pointer", fontSize: 13 }}>
          Voir en tableau
        </summary>
        <table style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Jour</th>
              <th>Vues</th>
              <th>Visiteurs</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.day}>
                <td>{p.label}</td>
                <td>{p.views}</td>
                <td>{p.visitors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
