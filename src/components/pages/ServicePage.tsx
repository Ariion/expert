import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { UptimeBar } from "@/components/UptimeBar";
import { WatchForm } from "@/components/WatchForm";
import {
  getDailyUptime,
  getIncidents,
  getRelatedServices,
  getReliability,
  getServiceBySlug,
} from "@/lib/queries";
import { APP_URL, SITE_NAME } from "@/lib/env";
import { fmtDate, fmtDuration, faviconFor, impactLabel, statusLabel, timeAgo } from "@/lib/format";
import { categoryLabel, dict, href, type Locale } from "@/lib/i18n";
import { descriptionFor } from "@/lib/catalog";

/**
 * LA page programmatique : une par fournisseur et par langue, revalidée toutes
 * les 2 minutes. C'est elle qui capte le trafic « <fournisseur> down / panne /
 * status » — la requête la plus intentionnelle du secteur, et la seule qui
 * remonte pile au moment où quelqu'un a un budget et un problème.
 */
export async function ServicePage({ locale, slug }: { locale: Locale; slug: string }) {
  const t = dict(locale);
  const L = (p: string) => href(locale, p);

  const service = await getServiceBySlug(slug).catch(() => null);
  if (!service) notFound();

  const [incidents, uptime, related, reliability] = await Promise.all([
    getIncidents(service.id, 25).catch(() => []),
    getDailyUptime(service.id, 90).catch(() => []),
    getRelatedServices(service.category, service.id, 6).catch(() => []),
    getReliability(service.id).catch(() => ({
      incidents: 0,
      downtime_minutes: 0,
      mttr_minutes: null,
      worst_minutes: null,
    })),
  ]);

  /** Minutes en durée lisible, ou « aucun » quand il n'y a rien à montrer. */
  const dur = (minutes: number | null) =>
    minutes && minutes > 0
      ? fmtDuration(new Date(0), new Date(minutes * 60_000), locale)
      : t.service.noneYet;

  const open = incidents.filter((i) => !i.is_resolved);
  const uptime90 =
    service.uptime_90d ??
    (uptime.length ? uptime.reduce((acc, d) => acc + Number(d.uptime_pct), 0) / uptime.length : null);

  const catLabel = categoryLabel(service.category, locale);
  const status = statusLabel(service.current_status, locale);

  // Données structurées : FAQ + fil d'Ariane. Ce sont elles qui décrochent les
  // rich results sur les requêtes « <service> down ».
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: [
      {
        "@type": "Question",
        name: t.service.faq.q1(service.name),
        acceptedAnswer: {
          "@type": "Answer",
          text: t.service.faq.a1(
            service.name,
            fmtDate(new Date()),
            status,
            open.length ? t.service.faq.a1Open(open.length, open[0].title) : t.service.faq.a1None,
          ),
        },
      },
      {
        "@type": "Question",
        name: t.service.faq.q2(service.name),
        acceptedAnswer: {
          "@type": "Answer",
          text: uptime90
            ? t.service.faq.a2(service.name, uptime90.toFixed(2), service.incident_count_90d)
            : t.service.faq.a2None(service.name, SITE_NAME),
        },
      },
      {
        "@type": "Question",
        name: t.service.faq.q3(service.name),
        acceptedAnswer: { "@type": "Answer", text: t.service.faq.a3(service.name, SITE_NAME) },
      },
    ],
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t.nav.providers, item: `${APP_URL()}${L("/status")}` },
      {
        "@type": "ListItem",
        position: 2,
        name: catLabel,
        item: `${APP_URL()}${L(`/categories/${service.category}`)}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: service.name,
        item: `${APP_URL()}${L(`/status/${service.slug}`)}`,
      },
    ],
  };

  return (
    <div className="wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <section className="hero" style={{ paddingBottom: 18 }}>
        <div className="dim">
          <Link href={L("/status")}>{t.nav.providers}</Link> ·{" "}
          <Link href={L(`/categories/${service.category}`)}>{catLabel}</Link>
        </div>
        <div className="flex" style={{ marginTop: 14 }}>
          <img
            className="logo-img"
            style={{ width: 34, height: 34 }}
            src={faviconFor(service.logo_domain)}
            alt=""
          />
          <h1 style={{ margin: 0 }}>{t.service.h1(service.name)}</h1>
        </div>
        <div className="row" style={{ marginTop: 16, alignItems: "center" }}>
          <StatusBadge status={service.current_status} locale={locale} />
          <span className="dim">
            {t.service.unchangedSince(timeAgo(service.current_status_since, locale))}
            {" · "}
            {t.service.exactSince(fmtDate(service.current_status_since))}
          </span>
        </div>
        <p className="lead" style={{ marginTop: 16 }}>
          {descriptionFor(service.slug, locale, service.description) ??
            t.service.fallbackDescription(service.name)}
        </p>
      </section>

      <section className="grid four">
        {[
          [t.service.kpiStatus, status],
          [t.service.kpiUptime, uptime90 ? `${uptime90.toFixed(2)} %` : "—"],
          [t.service.kpiIncidents, String(service.incident_count_90d)],
          [t.service.kpiLast, timeAgo(service.last_incident_at, locale)],
        ].map(([k, v]) => (
          <div className="card" key={k}>
            <div className="dim">{k}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </section>

      <section className="section">
        <h2>{t.service.severityTitle}</h2>
        <div className="grid three">
          {[
            [t.service.kpiDowntime, dur(reliability.downtime_minutes)],
            [t.service.kpiMttr, dur(reliability.mttr_minutes)],
            [t.service.kpiWorst, dur(reliability.worst_minutes)],
          ].map(([k, v]) => (
            <div className="card" key={k}>
              <div className="dim">{k}</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>
        <p className="dim" style={{ margin: "10px 0 0" }}>
          {t.service.severityNote}
        </p>
      </section>

      <section className="section">
        <h2>{t.service.uptimeTitle}</h2>
        <div className="card">
          <UptimeBar days={uptime} incidents={incidents} locale={locale} />
        </div>
      </section>

      {/* Placé juste avant le formulaire de surveillance : la quatrième étape
          est précisément ce que ce formulaire fait. */}
      <section className="section">
        <h2>{t.service.troubleshootTitle(service.name)}</h2>
        <div className="grid four">
          <div className="card">
            <h3>{t.service.troubleshoot1Title}</h3>
            <p style={{ fontSize: 13.5, margin: 0 }}>{t.service.troubleshoot1Body}</p>
          </div>
          <div className="card">
            <h3>{t.service.troubleshoot2Title}</h3>
            <p style={{ fontSize: 13.5, margin: 0 }}>
              {t.service.troubleshoot2Body(service.name)}
            </p>
            <a
              className="dim"
              href={service.status_page_url}
              rel="nofollow noopener"
              target="_blank"
              style={{ display: "inline-block", marginTop: 8, fontSize: 13 }}
            >
              {t.service.sourceCta} →
            </a>
          </div>
          <div className="card">
            <h3>{t.service.troubleshoot3Title}</h3>
            <p style={{ fontSize: 13.5, margin: 0 }}>
              {t.service.troubleshoot3Body(service.name)}
            </p>
            <a
              className="dim"
              href={`https://x.com/search?q=${encodeURIComponent(`${service.name} down`)}&f=live`}
              rel="nofollow noopener"
              target="_blank"
              style={{ display: "inline-block", marginTop: 8, fontSize: 13 }}
            >
              {t.service.troubleshoot3Cta(service.name)} →
            </a>
          </div>
          <div className="card">
            <h3>{t.service.troubleshoot4Title}</h3>
            <p style={{ fontSize: 13.5, margin: 0 }}>{t.service.troubleshoot4Body}</p>
          </div>
        </div>
      </section>

      <section className="section grid two">
        <div>
          <h2 style={{ marginTop: 0 }}>{t.service.historyTitle}</h2>
          <p className="dim" style={{ margin: "0 0 14px" }}>
            {t.service.providerWords(service.name)}
          </p>
          {incidents.length === 0 && (
            <div className="notice">{t.service.noIncidents(service.name)}</div>
          )}
          <div className="stack">
            {incidents.map((i) => (
              <div className={`card incident ${i.impact}`} key={i.id}>
                <div className="between">
                  <span className="pill">
                    {impactLabel(i.impact, locale)} ·{" "}
                    {i.is_resolved ? t.home.resolved : t.home.ongoing}
                  </span>
                  <span className="dim" style={{ whiteSpace: "nowrap", paddingLeft: 10 }}>
                    {fmtDate(i.started_at)}
                  </span>
                </div>
                <h3 style={{ marginTop: 10 }}>{i.title}</h3>
                <div className="dim">
                  {t.service.duration} {fmtDuration(i.started_at, i.resolved_at, locale)}
                  {i.resolved_at ? ` → ${fmtDate(i.resolved_at)}` : ""}
                  {i.url ? (
                    <>
                      {" · "}
                      <a href={i.url} rel="nofollow noopener" target="_blank">
                        {t.service.officialPost}
                      </a>
                    </>
                  ) : null}
                </div>
                {i.body ? <p>{i.body.slice(0, 400)}</p> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="stack">
          <WatchForm
            locale={locale}
            serviceId={service.id}
            serviceName={service.name}
            ongoing={open.length > 0}
          />
          <div className="card">
            <h3>{t.service.sourceTitle}</h3>
            <p style={{ fontSize: 13.5 }}>{t.service.sourceBody(service.name)}</p>
            <a
              className="btn ghost sm"
              href={service.status_page_url}
              rel="nofollow noopener"
              target="_blank"
            >
              {t.service.sourceCta}
            </a>
            <div className="dim" style={{ marginTop: 10 }}>
              {t.service.watchers(service.watcher_count, service.name, SITE_NAME)}
            </div>
          </div>

          {related.length > 0 && (
            <div className="card">
              <h3>{t.service.relatedTitle(catLabel)}</h3>
              <div className="stack" style={{ marginTop: 10 }}>
                {related.map((r) => (
                  <div className="between" key={r.id}>
                    <Link href={L(`/status/${r.slug}`)}>{r.name}</Link>
                    <StatusBadge status={r.current_status} locale={locale} />
                  </div>
                ))}
              </div>
              {related[0] && (
                <div style={{ marginTop: 14 }}>
                  <Link className="dim" href={L(`/compare/${service.slug}-vs-${related[0].slug}`)}>
                    {t.service.compareCta(service.name, related[0].name)}
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <h2>{t.service.faqTitle}</h2>
        <div className="grid two">
          {faq.mainEntity.map((q) => (
            <div className="card" key={q.name}>
              <h3>{q.name}</h3>
              <p style={{ fontSize: 14, margin: 0 }}>{q.acceptedAnswer.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
