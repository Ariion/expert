import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { StatusBadge } from "@/components/StatusBadge";
import { WatchForm } from "@/components/WatchForm";
import { getCategories, getServicesByCategory } from "@/lib/queries";
import { faviconFor, timeAgo } from "@/lib/format";

export const revalidate = 600;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const cats = await getCategories();
    return cats.map((c) => ({ slug: c.category }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const label = slug.replace(/-/g, " ");
  const services = await getServicesByCategory(slug).catch(() => []);
  return {
    title: `Statut des fournisseurs ${label} (${services.length} services surveillés)`,
    description: `Statut en direct, disponibilité et historique d'incidents des principaux fournisseurs ${label} : ${services
      .slice(0, 8)
      .map((s) => s.name)
      .join(", ")}.`,
    alternates: { canonical: `/categories/${slug}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const services = await getServicesByCategory(slug).catch(() => []);
  if (services.length === 0) notFound();
  const label = slug.replace(/-/g, " ");
  const down = services.filter((s) => s.current_status !== "operational");

  return (
    <div className="wrap">
      <section className="hero" style={{ paddingBottom: 10 }}>
        <div className="dim">
          <Link href="/categories">Catégories</Link>
        </div>
        <h1 style={{ textTransform: "capitalize" }}>Fournisseurs {label}</h1>
        <p className="lead">
          {services.length} services surveillés, {down.length} actuellement en incident. Données
          relevées automatiquement sur les pages de statut officielles.
        </p>
      </section>

      <section className="grid two">
        <div className="card" style={{ padding: 6 }}>
          <table>
            <thead>
              <tr>
                <th colSpan={2}>Service</th>
                <th>Dispo. 90 j</th>
                <th>Dernier incident</th>
                <th style={{ textAlign: "right" }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td style={{ width: 34 }}>
                    <img className="logo-img" src={faviconFor(s.logo_domain)} alt="" loading="lazy" />
                  </td>
                  <td>
                    <Link href={`/status/${s.slug}`}>{s.name}</Link>
                  </td>
                  <td className="dim">
                    {s.uptime_90d ? `${Number(s.uptime_90d).toFixed(2)} %` : "—"}
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
        <div className="stack">
          <WatchForm source={`category:${slug}`} />
          {services.length > 1 && (
            <div className="card">
              <h3>Comparatifs</h3>
              <div className="stack" style={{ marginTop: 8 }}>
                {services.slice(0, 5).map((s, idx) => {
                  const other = services[(idx + 1) % services.length];
                  if (other.id === s.id) return null;
                  return (
                    <Link key={s.id} href={`/compare/${s.slug}-vs-${other.slug}`} className="dim">
                      {s.name} vs {other.name} →
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
