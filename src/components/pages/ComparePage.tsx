import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { UptimeBar } from "@/components/UptimeBar";
import { WatchForm } from "@/components/WatchForm";
import { getDailyUptime, getServiceBySlug } from "@/lib/queries";
import { statusLabel, timeAgo } from "@/lib/format";
import { dict, href, type Locale } from "@/lib/i18n";

/**
 * Pages comparatives « A vs B ».
 *
 * Multiplicateur de surface : n services d'une même catégorie produisent
 * n×(n-1)/2 pages à intention commerciale, dans chaque langue, alimentées par
 * les mêmes données que les pages fournisseur. Coût marginal : zéro.
 */
export function splitPair(pair: string): [string, string] | null {
  const idx = pair.indexOf("-vs-");
  if (idx <= 0) return null;
  return [pair.slice(0, idx), pair.slice(idx + 4)];
}

export async function ComparePage({ locale, pair }: { locale: Locale; pair: string }) {
  const t = dict(locale);
  const L = (p: string) => href(locale, p);

  const parts = splitPair(pair);
  if (!parts) notFound();

  const [a, b] = await Promise.all([
    getServiceBySlug(parts[0]).catch(() => null),
    getServiceBySlug(parts[1]).catch(() => null),
  ]);
  if (!a || !b || a.id === b.id) notFound();

  const [ua, ub] = await Promise.all([
    getDailyUptime(a.id, 90).catch(() => []),
    getDailyUptime(b.id, 90).catch(() => []),
  ]);

  const avg = (rows: { uptime_pct: number }[]) =>
    rows.length ? rows.reduce((acc, r) => acc + Number(r.uptime_pct), 0) / rows.length : null;

  const ua90 = a.uptime_90d ?? avg(ua);
  const ub90 = b.uptime_90d ?? avg(ub);
  const winner = ua90 !== null && ub90 !== null ? (ua90 === ub90 ? null : ua90 > ub90 ? a : b) : null;

  return (
    <div className="wrap">
      <section className="hero" style={{ paddingBottom: 10 }}>
        <h1>{t.compare.h1(a.name, b.name)}</h1>
        <p className="lead">
          {t.compare.lead}
          {winner ? t.compare.leadWinner(winner.name) : t.compare.leadTie}
        </p>
      </section>

      <section className="grid two">
        {[
          { s: a, u: ua, pct: ua90 },
          { s: b, u: ub, pct: ub90 },
        ].map(({ s, u, pct }) => (
          <div className="card" key={s.id}>
            <div className="between">
              <h3 style={{ margin: 0 }}>
                <Link href={L(`/status/${s.slug}`)}>{s.name}</Link>
              </h3>
              <StatusBadge status={s.current_status} locale={locale} />
            </div>
            <div className="grid three" style={{ marginTop: 16 }}>
              <div>
                <div className="dim">{t.compare.kpiUptime}</div>
                <strong>{pct ? `${pct.toFixed(2)} %` : "—"}</strong>
              </div>
              <div>
                <div className="dim">{t.compare.kpiIncidents}</div>
                <strong>{s.incident_count_90d}</strong>
              </div>
              <div>
                <div className="dim">{t.compare.kpiLast}</div>
                <strong>{timeAgo(s.last_incident_at, locale)}</strong>
              </div>
            </div>
            <div style={{ marginTop: 18 }}>
              <UptimeBar days={u} locale={locale} />
            </div>
          </div>
        ))}
      </section>

      <section className="section grid two">
        <div className="card">
          <h3>{t.compare.readingTitle}</h3>
          <p style={{ fontSize: 14 }}>
            {t.compare.reading(
              a.name,
              statusLabel(a.current_status, locale),
              b.name,
              statusLabel(b.current_status, locale),
            )}
          </p>
        </div>
        <WatchForm locale={locale} source={`compare:${pair}`} />
      </section>
    </div>
  );
}
