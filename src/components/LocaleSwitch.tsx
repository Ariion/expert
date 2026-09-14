"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { otherLocale, translatePath, type Locale } from "@/lib/i18n";

/**
 * Bascule de langue.
 *
 * Elle pointe vers la MÊME page dans l'autre langue, pas vers l'accueil :
 * renvoyer un lecteur à la racine parce qu'il a changé de langue lui fait
 * perdre ce qu'il était venu lire, et c'est la façon la plus sûre de le perdre
 * tout court. Composant client uniquement pour connaître le chemin courant.
 */
export function LocaleSwitch({ locale }: { locale: Locale }) {
  const pathname = usePathname() ?? "/";
  const target = otherLocale(locale);
  const bare = locale === "en" ? pathname.replace(/^\/en(?=\/|$)/, "") || "/" : pathname;

  return (
    <Link className="link" href={translatePath(bare, target)} hrefLang={target} prefetch={false}>
      {target === "en" ? "English" : "Français"}
    </Link>
  );
}
