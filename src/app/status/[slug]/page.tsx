import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { StatusBadge } from "@/components/StatusBadge";
import { UptimeBar } from "@/components/UptimeBar";
import { WatchForm } from "@/components/WatchForm";
import {
  getDailyUptime,
  getIncidents,
  getRelatedServices,
  getServiceBySlug,
  getServiceSlugs,
} from "@/lib/queries";
import { APP_URL, SITE_NAME } from "@/lib/env";
import { IMPACT_LABEL, STATUS_LABEL, fmtDate, fmtDuration, faviconFor, timeAgo } from "@/lib/format";

/**
 * LA page programmatique : une par fournisseur, générée statiquement puis
 * revalidée toutes les 2 minutes. C'est elle qui capte le trafic
 * « <fournisseur> down / panne / status » — la requête la plus intentionnelle
 * du secteur, et la seule qui remonte pile au moment où quelqu'un a un budget
 * et un problème.
 */
export const revalidate = 120;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const slugs = await getServiceSlugs();
    return slugs.map((s) => ({ slug: s.slug }));
  } catch {
    return []; // pas de base au build : les pages seront générées à la demande
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = await getServiceBySlug(slug).catch(() => null);
  if (!service) return { title: "Fournisseur introuvable" };

  const down = service.current_status !== "operational";
  const title = `${service.name} est-il en panne ? Statut en direct et historique`;
  const description = `${service.name} : ${STATUS_LABEL[service.current_status]} (vérifié il y a moins de 5 minutes). Historique des incidents sur 90 jours, disponibilité mesurée et alerte gratuite par email dès la prochaine panne.`;

  return {
    title,
    description,
    alternates: { canonical: `/status/${service.slug}` },
    openGraph: {
      title: `${service.name} : ${STATUS_LABEL[service.current_status]}`,
      description,
      url: `${APP_URL()}/status/${service.slug}`,
      type: "website",
    },
    other: down ? { "status-indicator": service.current_status } : {},
  };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = await getServiceBySlug(slug).catch(() => null);
  if (!service) notFound();

  const [incidents, uptime, related] = await Promise.all([
    getIncidents(service.id, 25).catch(() => []),
    getDailyUptime(service.id, 90).catch(() => []),
    getRelatedServices(service.category, service.id, 6).catch(() => []),
  ]);

  const open = incidents.filter((i) => !i.is_resolved);
  const uptime90 =
    service.uptime_90d ??
    (uptime.length
      ? uptime.reduce((acc, d) => acc + Number(d.uptime_pct), 0) / uptime.length
      : null);

  // Données structurées : FAQ + fil d'Ariane. Ce sont elles qui décrochent les
  // rich results sur les requêtes « <service> down ».
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `${service.name} est-il en panne actuellement ?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Au dernier relevé (${fmtDate(new Date())}), ${service.name} est en état « ${
            STATUS_LABEL[service.current_status]
          } » d'après sa page de statut officielle. ${
            open.length
              ? `${open.length} incident(s) en cours : ${open[0].title}.`
              : "Aucun incident en cours n'est publié."
          }`,
        },
      },
      {
        "@type": "Question",
        name: `Quelle est la disponibilité de ${service.name} sur 90 jours ?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: uptime90
            ? `${service.name} affiche ${uptime90.toFixed(
                2,
              )} % de disponibilité sur les 90 derniers jours, avec ${
                service.incident_count_90d
              } incident(s) publiés.`
            : `L'historique de ${service.name} est en cours de constitution sur ${SITE_NAME}.`,
        },
      },
      {
        "@type": "Question",
        name: `Comment être prévenu automatiquement d'une panne de ${service.name} ?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Créez une alerte gratuite sur ${SITE_NAME} : dès qu'un incident est publié sur la status page de ${service.name}, vous recevez un email (ou une notification Slack/webhook avec un plan payant).`,
        },
      },
    ],
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Fournisseurs", item: `${APP_URL()}/status` },
      {
        "@type": "ListItem",
        position: 2,
        name: service.category,
        item: `${APP_URL()}/categories/${service.category}`,
      },
      { "@type": "ListItem", position: 3, name: service.name, item: `${APP_URL()}/status/${service.slug}` },
    ],
  };

  return (
    <div className="wrap">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <section className="hero" style={{ paddingBottom: 18 }}>
        <div className="dim">
          <Link href="/status">Fournisseurs</Link> ·{" "}
          <Link href={`/categories/${service.category}`} style={{ textTransform: "capitalize" }}>
            {service.category.replace(/-/g, " ")}
          </Link>
        </div>
        <div className="flex" style={{ marginTop: 14 }}>
          <img
            className="logo-img"
            style={{ width: 34, height: 34 }}
            src={faviconFor(service.logo_domain)}
            alt=""
          />
          <h1 style={{ margin: 0 }}>{service.name} est-il en panne&nbsp;?</h1>
        </div>
        <div className="row" style={{ marginTop: 16, alignItems: "center" }}>
          <StatusBadge status={service.current_status} />
          <span className="dim">
            état inchangé depuis {timeAgo(service.current_status_since)} · relevé automatique toutes
            les 5 minutes
          </span>
        </div>
        <p className="lead" style={{ marginTop: 16 }}>
          {service.description ??
            `${service.name} publie ses incidents sur une page de statut officielle. StatusPulse la surveille en continu et vous alerte automatiquement.`}
        </p>
      </section>

      <section className="grid four">
        {[
          ["Statut actuel", STATUS_LABEL[service.current_status]],
          ["Disponibilité 90 j", uptime90 ? `${uptime90.toFixed(2)} %` : "—"],
          ["Incidents 90 j", String(service.incident_count_90d)],
          ["Dernier incident", timeAgo(service.last_incident_at)],
        ].map(([k, v]) => (
          <div className="card" key={k}>
            <div className="dim">{k}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </section>

      <section className="section">
        <h2>Disponibilité sur 90 jours</h2>
        <div className="card">
          <UptimeBar days={uptime} />
        </div>
      </section>

      <section className="section grid two">
        <div>
          <h2 style={{ marginTop: 0 }}>Historique des incidents</h2>
          {incidents.length === 0 && (
            <div className="notice">
              Aucun incident publié par {service.name} sur la période collectée.
            </div>
          )}
          <div className="stack">
            {incidents.map((i) => (
              <div className={`card incident ${i.impact}`} key={i.id}>
                <div className="between">
                  <span className="pill">
                    {IMPACT_LABEL[i.impact] ?? i.impact} · {i.is_resolved ? "résolu" : "en cours"}
                  </span>
                  <span className="dim">{fmtDate(i.started_at)}</span>
                </div>
                <h3 style={{ marginTop: 10 }}>{i.title}</h3>
                <div className="dim">
                  Durée : {fmtDuration(i.started_at, i.resolved_at)}
                  {i.url ? (
                    <>
                      {" · "}
                      <a href={i.url} rel="nofollow noopener" target="_blank">
                        communication officielle
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
          <WatchForm serviceId={service.id} serviceName={service.name} />
          <div className="card">
            <h3>Source officielle</h3>
            <p style={{ fontSize: 13.5 }}>
              Les données de cette page proviennent exclusivement de la page de statut publique de{" "}
              {service.name}.
            </p>
            <a className="btn ghost sm" href={service.status_page_url} rel="nofollow noopener" target="_blank">
              Page de statut officielle
            </a>
            <div className="dim" style={{ marginTop: 10 }}>
              {service.watcher_count} personne(s) surveillent {service.name} via {SITE_NAME}.
            </div>
          </div>

          {related.length > 0 && (
            <div className="card">
              <h3>Autres services {service.category.replace(/-/g, " ")}</h3>
              <div className="stack" style={{ marginTop: 10 }}>
                {related.map((r) => (
                  <div className="between" key={r.id}>
                    <Link href={`/status/${r.slug}`}>{r.name}</Link>
                    <StatusBadge status={r.current_status} />
                  </div>
                ))}
              </div>
              {related[0] && (
                <div style={{ marginTop: 14 }}>
                  <Link className="dim" href={`/compare/${service.slug}-vs-${related[0].slug}`}>
                    Comparer {service.name} et {related[0].name} →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <h2>Questions fréquentes</h2>
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
