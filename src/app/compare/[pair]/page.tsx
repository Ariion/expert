import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { StatusBadge } from "@/components/StatusBadge";
import { UptimeBar } from "@/components/UptimeBar";
import { WatchForm } from "@/components/WatchForm";
import { getDailyUptime, getServiceBySlug } from "@/lib/queries";
import { STATUS_LABEL, timeAgo } from "@/lib/format";

/**
 * Pages comparatives « A vs B ».
 *
 * Multiplicateur de surface SEO : n services d'une même catégorie produisent
 * n×(n-1)/2 pages à intention commerciale (« Mailgun vs Sendgrid fiabilité »),
 * alimentées par les mêmes données que les pages fournisseur. Coût marginal
 * de production : zéro.
 */
export const revalidate = 900;
export const dynamicParams = true;

function splitPair(pair: string): [string, string] | null {
  const idx = pair.indexOf("-vs-");
  if (idx <= 0) return null;
  return [pair.slice(0, idx), pair.slice(idx + 4)];
}

/**
 * Aucune page n'est pré-rendue au build : `dynamicParams` les génère à la
 * première visite, puis l'ISR les maintient à jour. Pré-rendre des centaines de
 * pages exigeait autant d'allers-retours vers la base pendant la compilation —
 * un déploiement en est mort — pour un résultat que la revalidation remplace
 * quelques minutes plus tard de toute façon.
 */
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pair: string }>;
}): Promise<Metadata> {
  const { pair } = await params;
  const parts = splitPair(pair);
  if (!parts) return { title: "Comparatif introuvable" };
  const [a, b] = await Promise.all([
    getServiceBySlug(parts[0]).catch(() => null),
    getServiceBySlug(parts[1]).catch(() => null),
  ]);
  if (!a || !b) return { title: "Comparatif introuvable" };

  return {
    title: `${a.name} ou ${b.name} : lequel tombe le moins souvent ?`,
    description: `Comparatif de fiabilité ${a.name} vs ${b.name} : disponibilité sur 90 jours, nombre d'incidents et statut en direct, mesurés sur les status pages officielles.`,
    alternates: { canonical: `/compare/${pair}` },
  };
}

export default async function ComparePage({ params }: { params: Promise<{ pair: string }> }) {
  const { pair } = await params;
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
  const winner =
    ua90 !== null && ub90 !== null ? (ua90 === ub90 ? null : ua90 > ub90 ? a : b) : null;

  return (
    <div className="wrap">
      <section className="hero" style={{ paddingBottom: 10 }}>
        <h1>
          {a.name} vs {b.name} : fiabilité comparée
        </h1>
        <p className="lead">
          Comparatif fondé uniquement sur les incidents publiés par les fournisseurs eux-mêmes sur
          leurs pages de statut officielles, sur les 90 derniers jours.
          {winner
            ? ` Sur cette période, ${winner.name} affiche la meilleure disponibilité.`
            : " Les deux services affichent une disponibilité équivalente sur la période."}
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
                <Link href={`/status/${s.slug}`}>{s.name}</Link>
              </h3>
              <StatusBadge status={s.current_status} />
            </div>
            <div className="grid three" style={{ marginTop: 16 }}>
              <div>
                <div className="dim">Dispo. 90 j</div>
                <strong>{pct ? `${pct.toFixed(2)} %` : "—"}</strong>
              </div>
              <div>
                <div className="dim">Incidents 90 j</div>
                <strong>{s.incident_count_90d}</strong>
              </div>
              <div>
                <div className="dim">Dernier</div>
                <strong>{timeAgo(s.last_incident_at)}</strong>
              </div>
            </div>
            <div style={{ marginTop: 18 }}>
              <UptimeBar days={u} />
            </div>
          </div>
        ))}
      </section>

      <section className="section grid two">
        <div className="card">
          <h3>Lecture du comparatif</h3>
          <p style={{ fontSize: 14 }}>
            {a.name} est actuellement « {STATUS_LABEL[a.current_status]} », {b.name} est «{" "}
            {STATUS_LABEL[b.current_status]} ». Un fournisseur qui publie beaucoup d&apos;incidents
            n&apos;est pas nécessairement moins fiable : c&apos;est souvent le signe d&apos;une
            status page honnête et granulaire. L&apos;indicateur utile reste la durée cumulée
            d&apos;indisponibilité, affichée ci-dessus.
          </p>
        </div>
        <WatchForm source={`compare:${pair}`} />
      </section>
    </div>
  );
}
