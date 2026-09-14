import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { WatchForm } from "@/components/WatchForm";
import { getCategories, getGlobalStats, getRecentIncidents, getAllServices } from "@/lib/queries";
import { faviconFor, timeAgo, impactLabel } from "@/lib/format";
import { categoryLabel, dict, href, type Locale } from "@/lib/i18n";

export async function Home({ locale }: { locale: Locale }) {
  const t = dict(locale);
  const L = (p: string) => href(locale, p);

  const [stats, incidents, categories, services] = await Promise.all([
    getGlobalStats().catch(() => ({ services: 0, incidents_30d: 0, degraded_now: 0, watchers: 0 })),
    getRecentIncidents(8).catch(() => []),
    getCategories().catch(() => []),
    getAllServices().catch(() => []),
  ]);

  const trending = services.slice(0, 12);
  const cards: Array<[string, string, string]> = [
    [t.home.stats.detection[0], t.home.stats.detection[1], t.home.stats.detection[2]],
    [t.home.stats.providers[0], `${stats.services}`, t.home.stats.providers[1]],
    [t.home.stats.degraded[0], `${stats.degraded_now}`, t.home.stats.degraded[1]],
    [t.home.stats.effort[0], t.home.stats.effort[1], t.home.stats.effort[2]],
  ];

  return (
    <div className="wrap">
      <section className="hero">
        <span className="pill">{t.home.pill(stats.services, stats.incidents_30d)}</span>
        <h1 style={{ marginTop: 16 }}>
          {t.home.h1a}
          <br />
          {t.home.h1b}
        </h1>
        <p className="lead">{t.home.lead}</p>
        <div className="row" style={{ marginTop: 22 }}>
          <Link className="btn" href={L("/pricing")}>
            {t.home.ctaPrimary}
          </Link>
          <Link className="btn ghost" href={L("/status")}>
            {t.home.ctaSecondary}
          </Link>
        </div>
      </section>

      <section className="section grid four">
        {cards.map(([label, value, note]) => (
          <div className="card" key={label}>
            <div className="dim">{label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, margin: "4px 0" }}>{value}</div>
            <div className="dim">{note}</div>
          </div>
        ))}
      </section>

      <section className="section">
        <div className="between">
          <h2 style={{ margin: 0 }}>{t.home.recentIncidents}</h2>
          <Link href={L("/status")} className="dim">
            {t.home.seeAll}
          </Link>
        </div>
        <div className="grid two" style={{ marginTop: 14 }}>
          {incidents.length === 0 && <div className="notice">{t.home.noIncidents}</div>}
          {incidents.map((i) => (
            <div className={`card incident ${i.impact}`} key={i.id}>
              <div className="between">
                <Link href={L(`/status/${i.service_slug}`)} className="flex">
                  <img className="logo-img" src={faviconFor(i.logo_domain)} alt="" loading="lazy" />
                  <strong>{i.service_name}</strong>
                </Link>
                <span className="dim">{timeAgo(i.started_at, locale)}</span>
              </div>
              <h3 style={{ marginTop: 10 }}>{i.title}</h3>
              <div className="dim">
                {impactLabel(i.impact, locale)} ·{" "}
                {i.is_resolved ? t.home.resolved : t.home.ongoing}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>{t.home.mostWatched}</h2>
        <div className="grid four">
          {trending.map((s) => (
            <Link className="card link" key={s.id} href={L(`/status/${s.slug}`)}>
              <div className="flex">
                <img className="logo-img" src={faviconFor(s.logo_domain)} alt="" loading="lazy" />
                <strong>{s.name}</strong>
              </div>
              <div style={{ marginTop: 10 }}>
                <StatusBadge status={s.current_status} locale={locale} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section grid two">
        <div>
          <h2 style={{ marginTop: 0 }}>{t.home.howItWorks}</h2>
          <div className="stack">
            {t.home.steps.map(([title, body]) => (
              <div className="card" key={title}>
                <h3>{title}</h3>
                <p style={{ margin: 0, fontSize: 14 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="stack">
          <WatchForm locale={locale} source="home" />
          <div className="card">
            <h3>
              {t.plans.pro.name} — {t.plans.pro.priceLabel}
            </h3>
            <ul className="muted" style={{ fontSize: 14, paddingLeft: 18, margin: "8px 0 14px" }}>
              {t.plans.pro.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <Link className="btn" href={L("/pricing")}>
              {t.home.planCta}
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>{t.home.byCategory}</h2>
        <div className="grid four">
          {categories.map((c) => (
            <Link className="card link" key={c.category} href={L(`/categories/${c.category}`)}>
              <strong>{categoryLabel(c.category, locale)}</strong>
              <div className="dim" style={{ marginTop: 6 }}>
                {t.home.categoryCount(c.count, c.degraded)}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
