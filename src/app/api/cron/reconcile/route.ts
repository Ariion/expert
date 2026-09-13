import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/http";
import { cleanup, healthcheck, reconcileStripe } from "@/lib/maintenance";
import { trackCron } from "@/lib/ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Passe quotidienne d'auto-réparation :
 *  1. purge et remise en file des livraisons bloquées ;
 *  2. réconciliation Stripe (rattrape tout webhook perdu) ;
 *  3. watchdog : alerte humaine si le système s'est arrêté en silence.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return new NextResponse("non autorisé", { status: 401 });

  const stats = await trackCron("reconcile", async () => {
    const cleaned = await cleanup();
    const stripeSync = await reconcileStripe();
    const health = await healthcheck();
    return { cleaned, stripeSync, health };
  });

  return NextResponse.json({ ok: true, ...stats });
}
