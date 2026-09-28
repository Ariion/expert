import Link from "next/link";
import { APP_URL } from "@/lib/env";
import { dict, href, type Locale } from "@/lib/i18n";

/**
 * Documentation publique de l'API — page statique, aucune requête base.
 *
 * Les deux endpoints existent déjà (`/api/v1/status`, `/api/v1/incidents`) et
 * sont documentés informellement dans le tableau de bord. Cette page les rend
 * trouvables sans être connecté : c'est elle que cible « upstream status api »,
 * et elle sert de référence complète plutôt que d'un `<details>` replié.
 */
export function ApiDocs({ locale }: { locale: Locale }) {
  const t = dict(locale);
  const base = APP_URL();

  return (
    <div className="wrap">
      <section className="hero" style={{ paddingBottom: 10 }}>
        <h1>{t.apiPage.h1}</h1>
        <p className="lead">{t.apiPage.lead}</p>
      </section>

      <section className="section">
        <h2>{t.apiPage.authTitle}</h2>
        <p>{t.apiPage.authBody}</p>
        <pre
          className="mono"
          style={{
            padding: 14,
            background: "var(--bg-soft)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            overflowX: "auto",
            fontSize: 12.5,
          }}
        >
          {`Authorization: Bearer usk_…`}
        </pre>
        <Link className="btn sm" href={href(locale, "/dashboard")} style={{ marginTop: 4, display: "inline-block" }}>
          {t.apiPage.getKeyCta}
        </Link>
      </section>

      <section className="section">
        <h2>{t.apiPage.scopeTitle}</h2>
        <p>{t.apiPage.scopeBody}</p>
      </section>

      <section className="section grid two">
        <div className="card">
          <h3>{t.apiPage.statusTitle}</h3>
          <p style={{ fontSize: 13.5 }}>{t.apiPage.statusBody}</p>
          <pre
            className="mono"
            style={{
              marginTop: 10,
              padding: 14,
              background: "var(--bg-soft)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              overflowX: "auto",
              fontSize: 12.5,
            }}
          >
            {`curl -H "Authorization: Bearer usk_…" \\\n  ${base}/api/v1/status`}
          </pre>
        </div>
        <div className="card">
          <h3>{t.apiPage.incidentsTitle}</h3>
          <p style={{ fontSize: 13.5 }}>{t.apiPage.incidentsBody}</p>
          <pre
            className="mono"
            style={{
              marginTop: 10,
              padding: 14,
              background: "var(--bg-soft)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              overflowX: "auto",
              fontSize: 12.5,
            }}
          >
            {`curl -H "Authorization: Bearer usk_…" \\\n  ${base}/api/v1/incidents?days=30&limit=100`}
          </pre>
        </div>
      </section>
    </div>
  );
}
