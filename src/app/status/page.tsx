import Link from "next/link";
import type { Metadata } from "next";
import { StatusBadge } from "@/components/StatusBadge";
import { getAllServices, type Service } from "@/lib/queries";
import { faviconFor, timeAgo } from "@/lib/format";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Statut en direct de 100+ fournisseurs SaaS",
  description:
    "Tableau de bord unique : statut en temps réel, disponibilité et historique d'incidents de tous les fournisseurs SaaS et cloud majeurs.",
  alternates: { canonical: "/status" },
};

export default async function StatusIndex() {
  const services = await getAllServices().catch((): Service[] => []);
  const byCategory = new Map<string, Service[]>();
  for (const s of services) {
    if (!byCategory.has(s.category)) byCategory.set(s.category, []);
    byCategory.get(s.category)!.push(s);
  }

  return (
    <div className="wrap">
      <section className="hero" style={{ paddingBottom: 10 }}>
        <h1>Statut en direct de {services.length} fournisseurs</h1>
        <p className="lead">
          Relevé automatique des pages de statut officielles, toutes les 2 à 5 minutes. Cliquez sur
          un fournisseur pour son historique d&apos;incidents et sa disponibilité sur 90 jours.
        </p>
      </section>

      {[...byCategory.entries()].map(([category, list]) => (
        <section className="section" key={category}>
          <div className="between">
            <h2 style={{ margin: 0, textTransform: "capitalize" }}>{category.replace(/-/g, " ")}</h2>
            <Link className="dim" href={`/categories/${category}`}>
              Voir la catégorie →
            </Link>
          </div>
          <div className="card" style={{ marginTop: 12, padding: 6 }}>
            <table>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td style={{ width: 34 }}>
                      <img className="logo-img" src={faviconFor(s.logo_domain)} alt="" loading="lazy" />
                    </td>
                    <td>
                      <Link href={`/status/${s.slug}`}>{s.name}</Link>
                    </td>
                    <td className="dim">
                      {s.uptime_90d ? `${Number(s.uptime_90d).toFixed(2)} % / 90 j` : "—"}
                    </td>
                    <td className="dim">{timeAgo(s.last_incident_at)}</td>
                    <td style={{ textAlign: "right" }}>
                      <StatusBadge status={s.current_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
