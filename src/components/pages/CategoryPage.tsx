import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { WatchForm } from "@/components/WatchForm";
import { getServicesByCategory } from "@/lib/queries";
import { faviconFor, timeAgo } from "@/lib/format";
import { categoryLabel, dict, href, type Locale } from "@/lib/i18n";

export async function CategoryPage({ locale, slug }: { locale: Locale; slug: string }) {
  const t = dict(locale);
  const L = (p: string) => href(locale, p);

  const services = await getServicesByCategory(slug).catch(() => []);
  if (services.length === 0) notFound();

  const label = categoryLabel(slug, locale);
  const down = services.filter((s) => s.current_status !== "operational");

  return (
    <div className="wrap">
      <section className="hero" style={{ paddingBottom: 10 }}>
        <div className="dim">
          <Link href={L("/categories")}>{t.nav.categories}</Link>
        </div>
        <h1>{t.category.h1(label)}</h1>
        <p className="lead">{t.category.lead(services.length, down.length)}</p>
      </section>

      <section className="grid two">
        <div className="card" style={{ padding: 6 }}>
          <table>
            <thead>
              <tr>
                <th colSpan={2}>{t.category.thService}</th>
                <th>{t.category.thUptime}</th>
                <th>{t.category.thLast}</th>
                <th style={{ textAlign: "right" }}>{t.category.thStatus}</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td style={{ width: 34 }}>
                    <img className="logo-img" src={faviconFor(s.logo_domain)} alt="" loading="lazy" />
                  </td>
                  <td>
                    <Link href={L(`/status/${s.slug}`)}>{s.name}</Link>
                  </td>
                  <td className="dim">{s.uptime_90d ? `${Number(s.uptime_90d).toFixed(2)} %` : "—"}</td>
                  <td className="dim">{timeAgo(s.last_incident_at, locale)}</td>
                  <td style={{ textAlign: "right" }}>
                    <StatusBadge status={s.current_status} locale={locale} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="stack">
          <WatchForm locale={locale} source={`category:${slug}`} />
          {services.length > 1 && (
            <div className="card">
              <h3>{t.category.comparisons}</h3>
              <div className="stack" style={{ marginTop: 8 }}>
                {services.slice(0, 5).map((s, idx) => {
                  const other = services[(idx + 1) % services.length];
                  if (other.id === s.id) return null;
                  return (
                    <Link key={s.id} href={L(`/compare/${s.slug}-vs-${other.slug}`)} className="dim">
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
