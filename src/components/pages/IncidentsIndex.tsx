import Link from "next/link";
import { getRecentIncidents } from "@/lib/queries";
import { fmtDate, fmtDuration, impactLabel, faviconFor } from "@/lib/format";
import { dict, href, type Locale } from "@/lib/i18n";

/**
 * Le fil des incidents, tous fournisseurs confondus.
 *
 * La fiche fournisseur répond à « <X> est-il en panne », cette page répond à
 * « qu'est-ce qui vient de tomber, chez n'importe qui ». Même source de
 * données que l'accueil (`getRecentIncidents`), sans la limite à six lignes.
 */
export async function IncidentsIndex({ locale }: { locale: Locale }) {
  const t = dict(locale);
  const incidents = await getRecentIncidents(60).catch(() => []);

  return (
    <div className="wrap">
      <section className="hero" style={{ paddingBottom: 10 }}>
        <h1>{t.incidentsPage.h1}</h1>
        <p className="lead">{t.incidentsPage.lead}</p>
      </section>

      {incidents.length === 0 ? (
        <div className="notice">{t.incidentsPage.empty}</div>
      ) : (
        <div className="stack">
          {incidents.map((i) => (
            <div className={`card incident ${i.impact}`} key={i.id}>
              <div className="between">
                <span className="pill">
                  {impactLabel(i.impact, locale)} · {i.is_resolved ? t.home.resolved : t.home.ongoing}
                </span>
                <span className="dim" style={{ whiteSpace: "nowrap", paddingLeft: 10 }}>
                  {fmtDate(i.started_at)}
                </span>
              </div>
              <div className="flex" style={{ marginTop: 10, gap: 8 }}>
                <img className="logo-img" src={faviconFor(i.logo_domain)} alt="" loading="lazy" />
                <h3 style={{ margin: 0 }}>{i.title}</h3>
              </div>
              <div className="dim" style={{ marginTop: 6 }}>
                {t.service.duration} {fmtDuration(i.started_at, i.resolved_at, locale)}
                {i.resolved_at ? ` → ${fmtDate(i.resolved_at)}` : ""}
              </div>
              <div style={{ marginTop: 10 }}>
                <Link href={href(locale, `/status/${i.service_slug}`)}>
                  {i.service_name} — {t.incidentsPage.viewService}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
