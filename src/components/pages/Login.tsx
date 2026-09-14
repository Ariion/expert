import { dict, href, type Locale } from "@/lib/i18n";

export function Login({
  locale,
  sent,
  error,
  next,
}: {
  locale: Locale;
  sent?: string;
  error?: string;
  next?: string;
}) {
  const t = dict(locale).login;

  return (
    <div className="wrap" style={{ maxWidth: 480 }}>
      <section className="hero">
        <h1 style={{ fontSize: 26 }}>{t.h1}</h1>
        <p className="lead" style={{ fontSize: 15 }}>
          {t.lead}
        </p>

        {sent && (
          <div className="notice ok" style={{ marginBottom: 16 }}>
            {t.sent}
          </div>
        )}
        {error && (
          <div className="notice bad" style={{ marginBottom: 16 }}>
            {error === "invalid_token" ? t.expired : t.invalidEmail}
          </div>
        )}

        <form action="/api/auth/request" method="post" className="card">
          <input type="hidden" name="next" value={next ?? href(locale, "/dashboard")} />
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="back" value={href(locale, "/login")} />
          <label htmlFor="email">{t.emailLabel}</label>
          <input
            id="email"
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder={t.placeholder}
          />
          <button className="btn" type="submit" style={{ width: "100%", marginTop: 12 }}>
            {t.submit}
          </button>
        </form>
      </section>
    </div>
  );
}
