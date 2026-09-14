import Link from "next/link";
import { SITE_NAME } from "@/lib/env";
import { dict, href, type Locale } from "@/lib/i18n";
import { LocaleSwitch } from "./LocaleSwitch";

/**
 * En-tête et pied de page communs aux deux langues.
 *
 * Les deux racines (`(fr)` et `(en)`) ont chacune leur `<html lang>` — c'est la
 * seule façon d'annoncer correctement la langue à un lecteur d'écran comme à un
 * moteur — mais tout ce qui vient ensuite est ce composant, pour qu'une
 * correction de navigation n'ait jamais à être faite deux fois.
 */
export function SiteChrome({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const t = dict(locale);
  const L = (path: string) => href(locale, path);

  return (
    <>
      <nav className="nav">
        <div className="wrap nav-inner">
          <Link href={L("/")} className="brand">
            Status<span>Pulse</span>
          </Link>
          <Link href={L("/status")} className="link">
            {t.nav.providers}
          </Link>
          <Link href={L("/categories")} className="link">
            {t.nav.categories}
          </Link>
          <Link href={L("/pricing")} className="link">
            {t.nav.pricing}
          </Link>
          <div className="spacer" />
          <LocaleSwitch locale={locale} />
          <Link href={L("/dashboard")} className="link">
            {t.nav.login}
          </Link>
          <Link href={L("/pricing")} className="btn sm">
            {t.nav.start}
          </Link>
        </div>
      </nav>

      <main>{children}</main>

      <footer>
        <div className="wrap between">
          <div>
            <strong style={{ color: "var(--muted)" }}>{SITE_NAME}</strong> — {t.footer.tagline}
            <br />
            {t.footer.disclaimer}
          </div>
          <div className="row">
            <Link href={L("/status")}>{t.footer.allProviders}</Link>
            <Link href={L("/categories")}>{t.nav.categories}</Link>
            <Link href={L("/pricing")}>{t.nav.pricing}</Link>
            <Link href={L("/legal")}>{t.footer.legal}</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
