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
 * Effet secondaire utile : les cent vingt liens vers les pages fournisseur
 * partent désormais de la page la plus forte du site, dans les deux langues.
 */
export async function Home({ locale }: { locale: Locale }) {
  const t = dict(locale);
  const services = await getAllServices().catch(() => []);

  const down = services.filter((s) => isDown(s.current_status));

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
      <section className="hero" style={{ paddingBottom: 16 }}>
        <h1 style={{ fontSize: 27, margin: "0 0 6px" }}>{t.statusIndex.h1(services.length)}</h1>
        <p className="dim" style={{ margin: 0, fontSize: 14 }}>
          {t.home.summary(services.length, down.length)}
        </p>
      </section>

      {down.length > 0 && (
        <section style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: 17, margin: "0 0 12px" }}>{t.home.downNow}</h2>
          <div className="grid two">
            {down.slice(0, 6).map((s) => (
              <Link
                className={`card link incident ${s.current_status === "major_outage" ? "critical" : "major"}`}
                key={s.id}
                href={href(locale, `/status/${s.slug}`)}
              >
                <div className="between">
                  <span className="flex">
                    <img className="logo-img" src={faviconFor(s.logo_domain)} alt="" loading="lazy" />
                    <strong>{s.name}</strong>
                  </span>
                  <span className={`badge ${STATUS_TONE[s.current_status] ?? "muted"}`}>
                    <i className="dot" />
                    {statusLabel(s.current_status, locale)}
                  </span>
                </div>
                <div className="dim" style={{ marginTop: 8 }}>
                  {t.home.since(timeAgo(s.current_status_since, locale))}
                </div>
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
