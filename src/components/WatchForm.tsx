import { dict, href, type Locale } from "@/lib/i18n";

/**
 * Capture email — le point de conversion du trafic SEO.
 *
 * Formulaire HTML natif (POST vers un route handler) : fonctionne sans
 * JavaScript, donc sur n'importe quel appareil et pour n'importe quel crawler.
 * `locale` voyage avec le formulaire pour que la route renvoie le visiteur dans
 * sa langue, et lui écrive ses emails dans la même.
 */
export function WatchForm({
  locale,
  serviceId,
  serviceName,
  source = "status_page",
}: {
  locale: Locale;
  serviceId?: string;
  serviceName?: string;
  source?: string;
}) {
  const t = dict(locale).watch;

  return (
    <form action="/api/subscribe" method="post" className="card" style={{ background: "var(--bg-soft)" }}>
      <h3 style={{ marginBottom: 4 }}>
        {serviceName ? t.titleService(serviceName) : t.titleGeneric}
      </h3>
      <p style={{ fontSize: 13.5, margin: "0 0 12px" }}>{t.body}</p>
      <input type="hidden" name="service_id" value={serviceId ?? ""} />
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="back" value={href(locale, "/login")} />
      <div className="row">
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder={t.placeholder}
          aria-label={t.emailLabel}
        />
        <button className="btn" type="submit">
          {t.submit}
        </button>
      </div>
    </form>
  );
}
