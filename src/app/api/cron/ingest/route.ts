import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthorizedCron, runCron, unauthorizedCron } from "@/lib/http";
import { ensureCatalog } from "@/lib/bootstrap";
import { runIngestion } from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Collecteur — le moteur du produit. Déclenché toutes les 5 minutes par le
 * workflow « 3. Automatisation ».
 * Un lot de services « dus » est réclamé avec un bail : deux exécutions qui se
 * chevauchent ne traitent jamais le même fournisseur.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return unauthorizedCron();

  // Budget de temps : 25 secondes. Les planificateurs externes gratuits coupent
  // la requête à 30 s ; au-delà, la tâche serait comptée en échec alors qu'elle
  // travaille encore. Ce qui n'a pas été traité est remis en tête de file et
  // repris au tick suivant, sans perte.
  const deadline = Date.now() + 25_000;

  return runCron("ingest", async () => {
    // Base vide (première exécution) : le catalogue s'installe tout seul.
    const seeded = await ensureCatalog();
    const first = await runIngestion(40, 12, deadline);
    // Second lot si le premier était plein et qu'il reste du temps : on
    // rattrape sans attendre le tick suivant (utile après une panne ou un
    // ajout massif de services).
    const second =
      first.services === 40 && Date.now() < deadline - 10_000
        ? await runIngestion(40, 12, deadline)
        : { services: 0, changed: 0, queued: 0, deferred: 0 };
    // Rafraîchissement des pages d'ensemble — à chaque passage, sans condition.
    //
    // Une version précédente ne le faisait que sur changement réel, pour
    // éviter de payer le coût d'une reconstruction à chaque tick. Mais un
    // site fraîchement déployé sort du build avec des pages vides (aucune
    // requête n'a lieu pendant la compilation) : sans revalidation
    // inconditionnelle, rien ne les remplit jamais tant qu'aucun incident ne
    // survient nulle part — ce qui peut être des jours. Le site reste vide en
    // silence après chaque déploiement, la pire régression possible.
    //
    // Le vrai risque à l'origine du changement — une purge qui fait attendre
    // un visiteur pendant que la base est déjà sollicitée par la collecte —
    // est traité à la racine : pool de connexions réduit et borne de temps
    // dure sur chaque lecture de page (voir src/lib/db.ts, src/lib/queries.ts).
    // Revalidation systématique, donc, avec ces garde-fous en place.
    const changed = first.changed + second.changed;
    // Les deux langues, sans exception. N'en rafraîchir qu'une revient à
    // publier un site anglais figé sur l'état du déploiement : les pages
    // existent, répondent, et n'affichent aucun incident — la panne la plus
    // difficile à voir, puisque rien n'a l'air cassé.
    for (const path of [
      "/",
      "/status",
      "/categories",
      "/en",
      "/en/status",
      "/en/categories",
      "/sitemap/0.xml",
    ]) {
      try {
        revalidatePath(path);
      } catch {
        /* une revalidation qui échoue ne doit pas faire échouer la collecte */
      }
    }

    return {
      seeded,
      services: first.services + second.services,
      changed,
      queued: first.queued + second.queued,
      deferred: first.deferred + second.deferred,
    };
  });

}
