import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { getAllServices, type Service } from "@/lib/queries";
import { faviconFor, timeAgo } from "@/lib/format";
import { categoryLabel, dict, href, type Locale } from "@/lib/i18n";

export async function StatusIndex({ locale }: { locale: Locale }) {
  const t = dict(locale);
  const L = (p: string) => href(locale, p);

  const services = await getAllServices().catch((): Service[] => []);
  const byCategory = new Map<string, Service[]>();
  for (const s of services) {
    if (!byCategory.has(s.category)) byCategory.set(s.category, []);
    byCategory.get(s.category)!.push(s);
  }

  return (
    <div className="wrap">
      <section className="hero" style={{ paddingBottom: 10 }}>
        <h1>{t.statusIndex.h1(services.length)}</h1>
        <p className="lead">{t.statusIndex.lead}</p>
      </section>

      {[...byCategory.entries()].map(([category, list]) => (
        <section className="section" key={category}>
          <div className="between">
            <h2 style={{ margin: 0 }}>{categoryLabel(category, locale)}</h2>
            <Link className="dim" href={L(`/categories/${category}`)}>
              {t.statusIndex.seeCategory}
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
                      <Link href={L(`/status/${s.slug}`)}>{s.name}</Link>
                    </td>
                    <td className="dim">
                      {s.uptime_90d ? t.statusIndex.uptimeShort(Number(s.uptime_90d).toFixed(2)) : "—"}
                    </td>
                    <td className="dim">{timeAgo(s.last_incident_at, locale)}</td>
                    <td style={{ textAlign: "right" }}>
                      <StatusBadge status={s.current_status} locale={locale} />
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
