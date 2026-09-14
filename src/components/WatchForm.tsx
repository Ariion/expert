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
  ongoing = false,
}: {
  locale: Locale;
  serviceId?: string;
  serviceName?: string;
  source?: string;
  /** Une panne est en cours sur ce fournisseur : la promesse change. */
  ongoing?: boolean;
}) {
  const t = dict(locale).watch;
  const live = ongoing && Boolean(serviceName);

  return (
    <form action="/api/subscribe" method="post" className="card" style={{ background: "var(--bg-soft)" }}>
      <h3 style={{ marginBottom: 4 }}>
        {live ? t.titleOngoing(serviceName!) : serviceName ? t.titleService(serviceName) : t.titleGeneric}
      </h3>
      <p style={{ fontSize: 13.5, margin: "0 0 12px" }}>{live ? t.bodyOngoing : t.body}</p>
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
          {live ? t.submitOngoing : t.submit}
        </button>
      </div>
    </form>
  );
}
