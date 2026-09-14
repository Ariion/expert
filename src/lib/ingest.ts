import { sql } from "./db";
import { ops } from "./ops";
import { fetchFeed, hashIncident, type RawIncident, type ServiceStatus } from "./feeds";
import { PLANS } from "./plans";
import { SEED_SERVICES } from "@/data/services";
import { discoverFeeds, feedKindOf } from "./discover";

export interface ServiceRow {
  id: string;
  slug: string;
  name: string;
  feed_url: string;
  feed_kind: string;
  http_etag: string | null;
  http_last_modified: string | null;
  consecutive_failures: number;
  current_status: ServiceStatus;
  last_success_at: Date | null;
}

type EventKind = "opened" | "updated" | "resolved";

/** Cadence adaptative : on interroge plus vite ce qui est en train de casser. */
function nextDelayMinutes(status: ServiceStatus, failures: number): number {
  if (failures > 0) return Math.min(5 * 2 ** Math.min(failures, 4), 60); // 10,20,40,60…
  return status === "operational" || status === "unknown" ? 5 : 2;
}

/**
 * Réparation automatique d'un flux devenu injoignable.
 *
 * Un fournisseur qui migre de plateforme de statut ne prévient personne : son
 * ancienne adresse tombe en 404, ou pire, renvoie une page HTML en 200. Sans
 * rattrapage, la page correspondante se vide puis disparaît des résultats de
 * recherche — c'est-à-dire qu'une panne d'outillage se transforme en perte de
 * trafic permanente.
 *
 * On essaie donc les adresses de secours connues du catalogue, et on ne retient
 * qu'une adresse qui s'analyse réellement : un code 200 ne prouve rien, la page
 * d'erreur d'une status page migrée en renvoie un.
 *
 * Appelée après quelques échecs consécutifs seulement : inutile de sonder six
 * adresses parce qu'un flux a hoqueté une fois.
 */
async function tryRecoverFeed(service: ServiceRow): Promise<string | null> {
  const seed = SEED_SERVICES.find((s) => s.slug === service.slug);

  // D'abord les adresses connues, instantanées. Ensuite seulement, on lit la
  // status page pour lui demander où elle publie désormais son flux : c'est un
  // appel réseau de plus, qui ne se justifie que si les pistes gratuites ont
  // échoué — mais c'est le seul chemin qui marche pour un fournisseur dont
  // personne n'a écrit l'adresse de secours à l'avance.
  const known = (seed?.alt_feeds ?? []).filter((u) => u !== service.feed_url);
  const declared = seed?.status_page_url ? await discoverFeeds(seed.status_page_url) : [];
  const candidates = [...new Set([...known, ...declared])].filter((u) => u !== service.feed_url);

  for (const url of candidates) {
    const kind = feedKindOf(url);
    try {
      await fetchFeed({ feed_url: url, feed_kind: kind, http_etag: null, http_last_modified: null });
    } catch {
      continue;
    }
    await sql`
      update services
         set feed_url = ${url}, feed_kind = ${kind}, is_active = true,
             consecutive_failures = 0, last_error = null,
             http_etag = null, http_last_modified = null,
             next_fetch_at = now()
       where id = ${service.id}
    `;
    await ops.info("ingest", `Flux ${service.slug} récupéré sur une adresse de secours`, {
      slug: service.slug,
      from: service.feed_url,
      to: url,
    });
    return url;
  }
  return null;
}

/**
 * Met en file les alertes pour un incident, en une seule requête.
 *
 * Tout le filtrage produit est ici :
 *  - seuil de gravité choisi par l'utilisateur (`min_impact`) ;
 *  - canaux autorisés par le plan (Free = email uniquement) ;
 *  - délai d'alerte du plan Free (15 min) appliqué via `scheduled_at` ;
 *  - les mises à jour intermédiaires ne sont pas envoyées aux comptes Free ;
 *  - `on conflict do nothing` garantit l'idempotence : même si l'ingestion
 *    rejoue le même incident, l'alerte ne part qu'une fois.
 */
async function enqueueAlerts(
  service: { id: string; slug: string; name: string },
  incident: {
    id: string;
    title: string;
    body: string | null;
    url: string | null;
    impact: string;
    state: string;
    started_at: Date;
  },
  kind: EventKind,
): Promise<number> {
  const payload = {
    service: { id: service.id, slug: service.slug, name: service.name },
    incident: {
      id: incident.id,
      title: incident.title,
      body: incident.body,
      url: incident.url,
      impact: incident.impact,
      state: incident.state,
      started_at: incident.started_at,
    },
    kind,
  };

  const rows = await sql<{ id: string }[]>`
    insert into alert_deliveries (user_id, channel_id, incident_id, event_kind, payload, scheduled_at)
    select u.id,
           c.id,
           ${incident.id},
           ${kind},
           ${sql.json(payload)},
           now() + (case when u.plan = 'free'
                         then ${`${PLANS.free.alertDelayMinutes} minutes`}::interval
                         else '0 minutes'::interval end)
      from watch_items w
      join users u          on u.id = w.user_id
      join alert_channels c on c.user_id = u.id and c.is_active
     where w.service_id = ${service.id}
       and u.unsubscribed_at is null
       and u.email_verified
       and impact_rank(${incident.impact}) >= impact_rank(w.min_impact)
       and (u.plan <> 'free' or c.kind = 'email')
       and (u.plan <> 'free' or ${kind} <> 'updated')
    on conflict (channel_id, incident_id, event_kind) do nothing
    returning id
  `;
  return rows.length;
}

/** Ingestion d'un fournisseur : fetch -> normalisation -> diff -> alertes. */
export async function ingestService(service: ServiceRow): Promise<{
  slug: string;
  changed: number;
  queued: number;
  skipped: boolean;
}> {
  const isBackfill = service.last_success_at === null; // 1re ingestion : pas d'alerte rétroactive
  let changed = 0;
  let queued = 0;

  try {
    const feed = await fetchFeed(service);

    if (feed.notModified) {
      await sql`
        update services
           set consecutive_failures = 0,
               last_success_at = now(),
               last_error = null,
               next_fetch_at = now() + ${`${nextDelayMinutes(service.current_status, 0)} minutes`}::interval
         where id = ${service.id}
      `;
      return { slug: service.slug, changed: 0, queued: 0, skipped: true };
    }

    for (const raw of feed.incidents) {
      const result = await upsertIncident(service.id, raw);
      if (!result) continue;
      changed++;
      if (isBackfill) continue;

      // Deux garde-fous contre les alertes « fantômes », qui détruiraient la
      // confiance bien plus vite qu'une alerte manquée :
      //   - un incident démarré il y a plus de 48 h vient d'une archive du
      //     flux, pas d'un événement en train de se produire ;
      //   - un incident découvert alors qu'il est déjà clos n'a jamais été
      //     « ouvert » pour nous : on ne notifie pas sa résolution.
      const tooOld = raw.startedAt.getTime() < Date.now() - 48 * 3600_000;
      if (tooOld) continue;
      if (result.firstSeen && result.kind === "resolved") continue;

      queued += await enqueueAlerts(service, result.incident, result.kind);
    }

    const statusChanged = feed.status !== "unknown" && feed.status !== service.current_status;
    await sql`
      update services
         set current_status = ${feed.status === "unknown" ? service.current_status : feed.status},
             current_status_since = ${statusChanged ? new Date() : sql`current_status_since`},
             http_etag = ${feed.etag},
             http_last_modified = ${feed.lastModified},
             consecutive_failures = 0,
             last_error = null,
             last_success_at = now(),
             next_fetch_at = now() + ${`${nextDelayMinutes(feed.status, 0)} minutes`}::interval
       where id = ${service.id}
    `;

    return { slug: service.slug, changed, queued, skipped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failures = service.consecutive_failures + 1;

    await sql`
      update services
         set consecutive_failures = ${failures},
             last_error = ${message.slice(0, 500)},
             next_fetch_at = now() + ${`${nextDelayMinutes(service.current_status, failures)} minutes`}::interval
       where id = ${service.id}
    `.catch(() => {});

    // Un flux cassé n'est PAS un incident système : c'est de l'entretien de
    // catalogue. Un fournisseur qui change de plateforme de statut n'empêche
    // rien de fonctionner — les autres continuent, la page concernée est
    // simplement désactivée. Alerter un humain par email pour chacun, c'est
    // transformer une routine en avalanche : soixante fournisseurs qui migrent
    // font soixante emails par heure, et l'alerte utile se noie dedans.
    //
    // Le signalement passe donc par le journal (visible dans le diagnostic), et
    // par une seule alerte quotidienne quand le phénomène devient massif —
    // c'est la surveillance qui s'en charge, avec le compte global.
    await ops.warn("ingest", `Échec ${service.slug} (${failures}) : ${message}`, {
      slug: service.slug,
      feed_url: service.feed_url,
    });

    // Trois échecs d'affilée ne sont plus un hoquet réseau : on cherche si le
    // fournisseur a simplement déménagé sa status page. Une seule tentative de
    // réparation, au troisième échec, puis on laisse le backoff faire son
    // travail — sonder les adresses de secours à chaque tick coûterait plus
    // cher que la collecte elle-même.
    if (failures === 3 && (await tryRecoverFeed(service).catch(() => null))) {
      return { slug: service.slug, changed: 0, queued: 0, skipped: false };
    }

    // Au-delà de douze échecs (~6 h de backoff), le flux est mort : on le
    // désactive pour cesser de le solliciter et de publier une page vide.
    if (failures >= 12) {
      await sql`update services set is_active = false where id = ${service.id}`.catch(() => {});
      await ops.warn("ingest", `Flux ${service.slug} désactivé après ${failures} échecs`, {
        slug: service.slug,
      });
    }
    return { slug: service.slug, changed: 0, queued: 0, skipped: false };
  }
}

/**
 * Insère ou met à jour un incident. Retourne l'événement détecté, ou null si
 * rien n'a bougé (cas ultra-majoritaire : on ne réécrit pas la base pour rien).
 */
async function upsertIncident(
  serviceId: string,
  raw: RawIncident,
): Promise<{ kind: EventKind; incident: any; firstSeen: boolean } | null> {
  const hash = hashIncident(raw);

  const [existing] = await sql<
    { id: string; content_hash: string; is_resolved: boolean }[]
  >`
    select id, content_hash, is_resolved from incidents
     where service_id = ${serviceId} and external_id = ${raw.externalId} limit 1
  `;

  const isResolved = raw.resolvedAt !== null || raw.state === "resolved" || raw.state === "completed";

  if (!existing) {
    const [inserted] = await sql<any[]>`
      insert into incidents (service_id, external_id, title, body, url, impact, state,
                             is_resolved, started_at, resolved_at, content_hash)
      values (${serviceId}, ${raw.externalId}, ${raw.title}, ${raw.body}, ${raw.url},
              ${raw.impact}, ${raw.state}, ${isResolved}, ${raw.startedAt}, ${raw.resolvedAt},
              ${hash})
      on conflict (service_id, external_id) do nothing
      returning *
    `;
    if (!inserted) return null; // course concurrente : un autre worker l'a créé
    await sql`
      update services set last_incident_at = greatest(coalesce(last_incident_at, ${raw.startedAt}), ${raw.startedAt})
       where id = ${serviceId}
    `;
    return { kind: isResolved ? "resolved" : "opened", incident: inserted, firstSeen: true };
  }

  if (existing.content_hash === hash) return null;

  const [updated] = await sql<any[]>`
    update incidents
       set title = ${raw.title}, body = ${raw.body}, url = ${raw.url},
           impact = ${raw.impact}, state = ${raw.state}, is_resolved = ${isResolved},
           resolved_at = ${raw.resolvedAt}, content_hash = ${hash}
     where id = ${existing.id}
     returning *
  `;

  const kind: EventKind = isResolved && !existing.is_resolved ? "resolved" : "updated";
  return { kind, incident: updated, firstSeen: false };
}

/**
 * Boucle d'ingestion : prend un lot de services dus et les traite en parallèle.
 *
 * `deadline` borne le temps passé : une fonction serverless est tuée sans
 * préavis à l'échéance de son budget (60 s sur les offres d'entrée). On
 * s'arrête proprement avant, et surtout on **relibère les services non
 * traités** pour que l'exécution suivante les reprenne immédiatement au lieu
 * d'attendre l'expiration de leur bail.
 */
export async function runIngestion(
  batchSize = 40,
  concurrency = 8,
  deadline = Date.now() + 50_000,
) {
  const services = await sql<ServiceRow[]>`select * from claim_services_for_fetch(${batchSize})`;

  let changed = 0;
  let queued = 0;
  const queue = [...services];

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (let job = queue.shift(); job && Date.now() < deadline; job = queue.shift()) {
      const r = await ingestService(job);
      changed += r.changed;
      queued += r.queued;
    }
  });
  await Promise.all(workers);

  if (queue.length > 0) {
    await sql`
      update services set next_fetch_at = now() where id in ${sql(queue.map((s) => s.id))}
    `.catch(() => {});
  }

  return { services: services.length - queue.length, changed, queued, deferred: queue.length };
}
