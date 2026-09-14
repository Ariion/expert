import { DESCRIPTIONS_EN } from "@/data/descriptions.en";
import type { Locale } from "./i18n";

/**
 * Description d'un fournisseur dans la langue affichée.
 *
 * La base ne stocke que la version française — c'est la seule qui puisse
 * changer en production, par correction manuelle. L'anglais vit dans le code,
 * où il se relit et se corrige comme n'importe quel texte du site. Une clé
 * absente renvoie `null` plutôt que du français sur une page anglaise : la page
 * bascule alors sur sa phrase générique, ce qu'aucun lecteur ne remarque.
 */
export function descriptionFor(
  slug: string,
  locale: Locale,
  stored: string | null | undefined,
): string | null {
  if (locale === "en") return DESCRIPTIONS_EN[slug] ?? null;
  return stored ?? null;
}
