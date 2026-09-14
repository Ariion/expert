import { NextResponse } from "next/server";
import { isAuthorizedCron, runCron, unauthorizedCron } from "@/lib/http";
import { cleanup, healthcheck, reconcileStripe, retryDisabledFeeds } from "@/lib/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Passe quotidienne d'auto-réparation :
 *  1. purge et remise en file des livraisons bloquées ;
 *  2. réconciliation Stripe (rattrape tout webhook perdu) ;
 *  3. deuxième chance pour les flux désactivés ;
 *  4. watchdog : alerte humaine si le système s'est arrêté en silence.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return unauthorizedCron();

  return runCron("reconcile", async () => {
    const cleaned = await cleanup();
    const stripeSync = await reconcileStripe();
    const revived = await retryDisabledFeeds();
    const health = await healthcheck();
    return { cleaned, stripeSync, revived, health };
  });

}
