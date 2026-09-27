import Link from "next/link";
import { ServiceBoard, type BoardRow } from "@/components/ServiceBoard";
import { getAllServices } from "@/lib/queries";
import { STATUS_TONE, faviconFor, isDown, statusLabel, timeAgo } from "@/lib/format";
import { categoryLabel, dict, href, type Locale } from "@/lib/i18n";

/**
 * L'accueil est un tableau de bord, pas une plaquette.
 *
 * Quelqu'un qui arrive ici veut savoir si un service est en panne. Lui servir
 * d'abord un slogan, puis des arguments, puis enfin l'information, c'est le
 * faire partir avant la réponse. La vente vit sur /pricing, où va de toute
 * façon celui qui a compris à quoi sert le produit.
 *
 * Effet secondaire utile : les cent soixante liens vers les pages fournisseur
 * partent désormais de la page la plus forte du site, dans les deux langues.
 */
export async function Home({ locale }: { locale: Locale }) {
  const t = dict(locale);
  const services = await getAllServices().catch(() => []);

  const down = services.filter((s) => isDown(s.current_status));
  const ok = services.length - down.length;
  const pct = services.length > 0 ? Math.max(0, Math.min(100, (ok / services.length) * 100)) : 100;

  // Ce qui ne va pas d'abord, puis l'ordre alphabétique : l'information rare
  // est celle qui compte, et elle ne doit pas se chercher.
  const ordered = [...services].sort((a, b) => {
    const ka = isDown(a.current_status) ? 0 : 1;
    const kb = isDown(b.current_status) ? 0 : 1;
    return ka - kb || a.name.localeCompare(b.name);
  });

  const rows: BoardRow[] = ordered.map((s) => ({
    slug: s.slug,
    name: s.name,
    category: categoryLabel(s.category, locale),
    href: href(locale, `/status/${s.slug}`),
    logo: faviconFor(s.logo_domain),
    status: statusLabel(s.current_status, locale),
    tone: STATUS_TONE[s.current_status] ?? "muted",
  }));

  return (
    <div className="wrap">
      <section className="status-hero">
        <span className="status-hero-eyebrow">
          <i className="dot ok" />
          {t.home.heroEyebrow}
        </span>

        {down.length === 0 ? (
          <h1 className="status-hero-figure ok">{t.home.heroAllOk}</h1>
        ) : (
          <>
            <h1 className="status-hero-figure">{t.home.heroOperational(ok)}</h1>
            <p className="status-hero-sub">{t.home.heroOf(services.length)}</p>
          </>
        )}

        <div className="status-hero-bar" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>

        <div className="status-hero-foot">
          <span className={down.length > 0 ? "warn" : "dim"}>
            {down.length > 0 ? t.home.heroAffected(down.length) : t.home.allServices}
          </span>
          <span className="dim">{t.home.heroCaption}</span>
        </div>
      </section>

      {down.length > 0 && (
        <section style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: 17, margin: "0 0 12px" }}>{t.home.downNow}</h2>
          <div className="incident-compact">
            {down.map((s) => (
              <Link className="incident-compact-row" key={s.id} href={href(locale, `/status/${s.slug}`)}>
                <img className="logo-img" src={faviconFor(s.logo_domain)} alt="" loading="lazy" />
                <span className="incident-compact-name">
                  {s.name}
                  <span className="dim">{t.home.since(timeAgo(s.current_status_since, locale))}</span>
                </span>
                <span className={`badge ${STATUS_TONE[s.current_status] ?? "muted"}`}>
                  <i className="dot" />
                  {statusLabel(s.current_status, locale)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 style={{ fontSize: 17, margin: "0 0 12px" }}>{t.home.allServices}</h2>
        <ServiceBoard
          rows={rows}
          searchLabel={t.home.searchLabel}
          searchPlaceholder={t.home.searchPlaceholder}
          noMatch={t.home.noMatch}
          noMatchHint={t.home.noMatchHint}
          catAll={t.home.catAll}
        />
      </section>

      <div className="strip">
        <span>{t.home.pitch}</span>
        <Link className="btn sm" href={href(locale, "/pricing")}>
          {t.home.pitchCta}
        </Link>
      </div>
    </div>
  );
}
