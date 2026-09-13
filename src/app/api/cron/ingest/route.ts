import { NextResponse } from "next/server";
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

  // Budget de temps : on s'arrête avant que la plateforme ne coupe la fonction.
  const deadline = Date.now() + 50_000;

  return runCron("ingest", async () => {
    // Base vide (première exécution) : le catalogue s'installe tout seul.
    const seeded = await ensureCatalog();
    const first = await runIngestion(40, 8, deadline);
    // Second lot si le premier était plein et qu'il reste du temps : on
    // rattrape sans attendre le tick suivant (utile après une panne ou un
    // ajout massif de services).
    const second =
      first.services === 40 && Date.now() < deadline - 15_000
        ? await runIngestion(40, 8, deadline)
        : { services: 0, changed: 0, queued: 0, deferred: 0 };
    return {
      seeded,
      services: first.services + second.services,
      changed: first.changed + second.changed,
      queued: first.queued + second.queued,
      deferred: first.deferred + second.deferred,
    };
  });

}
