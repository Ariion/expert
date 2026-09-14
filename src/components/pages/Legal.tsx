import { SITE_NAME, publisher } from "@/lib/env";
import { dict, type Locale } from "@/lib/i18n";

export function Legal({ locale }: { locale: Locale }) {
  const t = dict(locale).legal;
  const who = publisher();

  return (
    <div className="wrap">
      <section className="hero" style={{ paddingBottom: 10 }}>
        <h1>{t.h1}</h1>
      </section>
      <div className="stack" style={{ maxWidth: 720 }}>
        <div className="card">
          <h3>{t.publisherTitle}</h3>
          {who ? (
            <p style={{ fontSize: 14 }}>
              {who.name}
              <br />
              {t.publisherRegistration} : {who.registration}
              {who.address && (
                <>
                  <br />
                  {who.address}
                </>
              )}
              {who.email && (
                <>
                  <br />
                  {t.publisherContact} : <a href={`mailto:${who.email}`}>{who.email}</a>
                </>
              )}
            </p>
          ) : (
            <p className="dim" style={{ fontSize: 14 }}>
              {t.publisherMissing}
            </p>
          )}
        </div>
        <div className="card">
          <h3>{t.hostingTitle}</h3>
          <p style={{ fontSize: 14 }}>{t.hostingBody}</p>
        </div>
        <div className="card">
          <h3>{t.sourcesTitle}</h3>
          <p style={{ fontSize: 14 }}>{t.sourcesBody(SITE_NAME)}</p>
        </div>
        <div className="card">
          <h3>{t.dataTitle}</h3>
          <p style={{ fontSize: 14 }}>{t.dataBody}</p>
        </div>
        <div className="card">
          <h3>{t.liabilityTitle}</h3>
          <p style={{ fontSize: 14 }}>{t.liabilityBody(SITE_NAME)}</p>
        </div>
      </div>
    </div>
  );
}
