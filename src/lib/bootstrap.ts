import { sql } from "./db";
import { ops } from "./ops";
import { SEED_SERVICES } from "@/data/services";

/**
 * Auto-amorçage et rattrapage du catalogue.
 *
 * Appelé au début de chaque ingestion. Deux situations :
 *
 *  1. table vide (première exécution, ou base recréée) → tout le catalogue
 *     est inséré ;
 *  2. catalogue élargi dans `src/data/services.ts` → seuls les fournisseurs
 *     manquants sont insérés.
 *
 * Le second cas est la raison d'être de cette fonction : une page qui n'existe
 * pas en base n'est pas publiée, donc pas indexée, donc n'amène personne. Faire
 * dépendre l'arrivée de nouvelles pages d'un script lancé à la main revient à
 * décider que l'élargissement du catalogue n'aura jamais lieu.
 *
 * Coût par tick : un `count(*)`. La lecture des slugs et les insertions
 * n'arrivent que lorsque la base est réellement en retard sur le code, ce qui
 * ne se produit qu'après un déploiement qui ajoute des fournisseurs.
 *
 * Ce qui est déjà en base n'est jamais réécrit (`do nothing`) : les réglages
 * appliqués directement en production — flux corrigé, service désactivé —
 * survivent à chaque passage.
 */
export async function ensureCatalog(): Promise<number> {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from services`;
  if (n >= SEED_SERVICES.length) return 0;

  const known = new Set(
    (await sql<{ slug: string }[]>`select slug from services`).map((r) => r.slug),
  );
  const missing = SEED_SERVICES.filter((s) => !known.has(s.slug));
  if (missing.length === 0) return 0;

  let inserted = 0;
  for (const s of missing) {
    try {
      await sql`
        insert into services (slug, name, category, description, homepage, status_page_url,
                              feed_url, feed_kind, logo_domain)
        values (${s.slug}, ${s.name}, ${s.category}, ${s.description}, ${s.homepage},
                ${s.status_page_url}, ${s.feed_url}, ${s.feed_kind}, ${s.logo_domain})
        on conflict (slug) do nothing
      `;
      inserted++;
    } catch (err) {
      await ops.warn("bootstrap", `Service ${s.slug} non inséré : ${String(err)}`);
    }
  }

  await ops.info(
    "bootstrap",
    n === 0
      ? `Catalogue amorcé automatiquement : ${inserted} fournisseurs.`
      : `Catalogue complété : ${inserted} nouveaux fournisseurs (${n} déjà présents).`,
  );
  return inserted;
}
