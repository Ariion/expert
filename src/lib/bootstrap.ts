import { sql } from "./db";
import { ops } from "./ops";
import { SEED_SERVICES } from "@/data/services";

/**
 * Auto-amorçage du catalogue.
 *
 * Appelé au début de chaque ingestion : si la table `services` est vide (toute
 * première exécution, ou base recréée), le catalogue est inséré tout seul.
 * Conséquence : il n'y a aucune étape manuelle de « seed » à ne pas oublier —
 * le système se met en marche à la première minute de vie.
 *
 * Les services ajoutés ensuite dans src/data/services.ts sont, eux, repris par
 * `npm run db:seed` (ou par la prochaine exécution de `npm run setup`), pour
 * éviter d'écraser à chaque tick des ajustements faits directement en base.
 */
export async function ensureCatalog(): Promise<number> {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from services`;
  if (n > 0) return 0;

  let inserted = 0;
  for (const s of SEED_SERVICES) {
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

  await ops.info("bootstrap", `Catalogue amorcé automatiquement : ${inserted} fournisseurs.`);
  return inserted;
}
