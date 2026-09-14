import type { Metadata } from "next";
import { APP_URL } from "./env";
import { LOCALES, href, translatePath, type Locale } from "./i18n";

/**
 * Balises `alternates` d'une page, dans les deux langues.
 *
 * Sans `hreflang`, Google traite la page française et la page anglaise comme
 * deux pages concurrentes sur le même sujet et en déclasse une : la version
 * anglaise coûterait alors du trafic au lieu d'en apporter. Le `canonical` est
 * toujours celui de la langue affichée, jamais celui de l'autre.
 *
 * `path` est le chemin SANS préfixe de langue (« /status/github »).
 */
export function alternates(path: string, locale: Locale): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = translatePath(path, l);
  languages["x-default"] = href("en", path);
  return { canonical: href(locale, path), languages };
}

export function absolute(path: string, locale: Locale): string {
  return `${APP_URL()}${href(locale, path)}`;
}
