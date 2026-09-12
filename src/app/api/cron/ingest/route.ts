import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/http";
import { ensureCatalog } from "@/lib/bootstrap";
import { runIngestion } from "@/lib/ingest";
import { trackCron } from "@/lib/ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Collecteur — le moteur du produit. Toutes les 5 minutes (vercel.json).
 * Un lot de services « dus » est réclamé avec un bail : deux exécutions qui se
 * chevauchent ne traitent jamais le même fournisseur.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return new NextResponse("non autorisé", { status: 401 });

  const stats = await trackCron("ingest", async () => {
    // Base vide (première exécution) : le catalogue s'installe tout seul.
    const seeded = await ensureCatalog();
    const first = await runIngestion(40, 8);
    // Second lot si le premier était plein : on rattrape sans attendre le tick
    // suivant (utile après une panne ou un ajout massif de services).
    const second = first.services === 40 ? await runIngestion(40, 8) : { services: 0, changed: 0, queued: 0 };
    return {
      seeded,
      services: first.services + second.services,
      changed: first.changed + second.changed,
      queued: first.queued + second.queued,
    };
  });

  return NextResponse.json({ ok: true, ...stats });
}
