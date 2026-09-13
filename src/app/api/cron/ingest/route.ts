import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthorizedCron, runCron } from "@/lib/http";
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
  if (!isAuthorizedCron(req)) return new NextResponse("non autorisé", { status: 401 });

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
    // Les pages d'ensemble sortent vides du build (aucune requête pendant la
    // compilation) et ne se rafraîchiraient qu'à l'expiration de leur fenêtre
    // de revalidation — jusqu'à une heure pour le sitemap. La collecte, qui
    // connaît l'état réel, les rafraîchit elle-même : le site est juste dans
    // les minutes qui suivent un déploiement, pas dans l'heure.
    for (const path of ["/", "/status", "/categories", "/sitemap/0.xml"]) {
      try {
        revalidatePath(path);
      } catch {
        /* une revalidation qui échoue ne doit pas faire échouer la collecte */
      }
    }

    return {
      seeded,
      services: first.services + second.services,
      changed: first.changed + second.changed,
      queued: first.queued + second.queued,
      deferred: first.deferred + second.deferred,
    };
  });

}
