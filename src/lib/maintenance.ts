import { sql } from "./db";
import { ops } from "./ops";
import { stripe, syncSubscriptionToUser } from "./stripe";

/**
 * Nettoyage : la base ne doit jamais grossir indéfiniment sans surveillance
 * humaine. Chaque exécution borne la rétention de toutes les tables chaudes.
 */
export async function cleanup(): Promise<Record<string, number>> {
  const stats: Record<string, number> = {};

  const del = async (label: string, run: () => Promise<{ count: number }>) => {
    try {
      const res = await run();
      stats[label] = res.count;
    } catch (err) {
      stats[label] = -1;
      await ops.warn("cleanup", `Purge ${label} en échec : ${String(err)}`);
    }
  };

  await del("sessions", () => sql`delete from sessions where expires_at < now()`);
  await del("auth_tokens", () => sql`delete from auth_tokens where expires_at < now() - interval '2 days'`);
  await del("cron_runs", () => sql`delete from cron_runs where started_at < now() - interval '30 days'`);
  await del("ops_events", () => sql`delete from ops_events where created_at < now() - interval '30 days'`);
  await del("stripe_events", () => sql`delete from stripe_events where received_at < now() - interval '90 days'`);
  await del(
    "alert_deliveries",
    () => sql`delete from alert_deliveries
               where status in ('sent','skipped','dead') and created_at < now() - interval '45 days'`,
  );
  await del(
    "incidents",
    () => sql`delete from incidents where started_at < now() - interval '400 days'`,
  );

  // Livraisons bloquées en 'sending' (lambda tuée en plein vol) : on les remet
  // en file plutôt que de perdre l'alerte.
  const requeued = await sql`
    update alert_deliveries
       set status = 'pending', locked_at = null
     where status = 'sending' and locked_at < now() - interval '15 minutes'
  `;
  stats.requeued = requeued.count;

  return stats;
}

/**
 * Réconciliation Stripe : Stripe est la source de vérité, la base n'en est
 * qu'une projection. Si un webhook a été perdu, cette passe quotidienne
 * rattrape l'écart — un client qui a payé ne reste jamais bloqué en Free.
 */
export async function reconcileStripe(maxPages = 5): Promise<{ synced: number }> {
  let synced = 0;
  let startingAfter: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const batch = await stripe().subscriptions.list({
      status: "all",
      limit: 100,
      starting_after: startingAfter,
    });

    for (const sub of batch.data) {
      try {
        await syncSubscriptionToUser(sub);
        synced++;
      } catch (err) {
        await ops.warn("reconcile", `Sync abonnement ${sub.id} en échec : ${String(err)}`);
      }
    }

    if (!batch.has_more || batch.data.length === 0) break;
    startingAfter = batch.data[batch.data.length - 1].id;
  }

  return { synced };
}

/**
 * Watchdog : détecte les pannes silencieuses — celles qui ne lèvent aucune
 * exception parce que plus rien ne s'exécute.
 */
export async function healthcheck(): Promise<{ ok: boolean; checks: Record<string, unknown> }> {
  const checks: Record<string, unknown> = {};
  let ok = true;

  const [ingest] = await sql<{ last: Date | null }[]>`
    select max(finished_at) as last from cron_runs where job = 'ingest' and ok
  `;
  checks.lastIngest = ingest?.last ?? null;
  if (!ingest?.last || Date.now() - new Date(ingest.last).getTime() > 45 * 60_000) {
    ok = false;
    await ops.critical(
      "healthcheck",
      "Aucune ingestion réussie depuis plus de 45 minutes : le collecteur est à l'arrêt.",
      { lastIngest: ingest?.last },
      "ingest-stalled",
    );
  }

  const [backlog] = await sql<{ n: number }[]>`
    select count(*)::int as n from alert_deliveries
     where status = 'pending' and scheduled_at < now() - interval '30 minutes'
  `;
  checks.stuckDeliveries = backlog.n;
  if (backlog.n > 0) {
    ok = false;
    await ops.critical(
      "healthcheck",
      `${backlog.n} alertes en retard de plus de 30 minutes : la file ne se vide plus.`,
      { backlog: backlog.n },
      "dispatch-backlog",
    );
  }

  const [dead] = await sql<{ n: number }[]>`
    select count(*)::int as n from alert_deliveries
     where status = 'dead' and created_at > now() - interval '1 day'
  `;
  checks.deadDeliveries = dead.n;

  const [feeds] = await sql<{ n: number }[]>`
    select count(*)::int as n from services where is_active and consecutive_failures >= 6
  `;
  checks.brokenFeeds = feeds.n;
  if (feeds.n > 5) {
    ok = false;
    await ops.critical(
      "healthcheck",
      `${feeds.n} flux fournisseurs cassés simultanément : panne réseau ou blocage sortant probable.`,
      { brokenFeeds: feeds.n },
      "feeds-mass-failure",
    );
  }

  // Un compte payant sans abonnement Stripe actif = incohérence de facturation.
  const [drift] = await sql<{ n: number }[]>`
    select count(*)::int as n from users
     where plan <> 'free' and stripe_subscription_id is null
  `;
  checks.billingDrift = drift.n;
  if (drift.n > 0) {
    await ops.warn("healthcheck", `${drift.n} comptes payants sans abonnement Stripe rattaché.`);
  }

  return { ok, checks };
}
