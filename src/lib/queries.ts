import { cache } from "react";
import { sql, withTimeout } from "./db";
import type { ServiceStatus } from "./feeds";

/**
 * Le build ne doit jamais interroger la base.
 *
 * Les pages sont revalidées en continu (ISR) : les pré-rendre avec des données
 * fraîches n'apporte rien, puisqu'elles seront de toute façon régénérées dans
 * les minutes qui suivent. En revanche, faire traverser l'Atlantique à
 * plusieurs centaines de requêtes pendant la compilation rend le déploiement
 * lent, fragile, et dépendant de la disponibilité d'un service tiers — un
 * déploiement a échoué exactement là-dessus.
 *
 * Pendant la phase de build, les lectures renvoient donc du vide. Les pages
 * sortent instantanément, et se remplissent à la première visite.
 */
// La clé est assemblée à l'exécution : écrite en clair, `process.env.NEXT_PHASE`
// serait remplacée par sa valeur au moment de la compilation, et le garde
// resterait actif en production — les pages seraient servies vides pour
// toujours. Un accès par clé calculée ne peut pas être remplacé.
const PHASE_KEY = ["NEXT", "PHASE"].join("_");
const isBuildPhase = () => process.env[PHASE_KEY] === "phase-production-build";

/**
 * Toute lecture de page est bornée dans le temps.
 *
 * Ces requêtes s'exécutent pendant le rendu : tant qu'elles n'ont pas répondu,
 * le visiteur regarde une page blanche. Deux secondes et demie suffisent
 * largement à n'importe laquelle d'entre elles ; au-delà, c'est que la base ne
 * répondra pas, et il vaut mieux servir la page sans ses données que ne pas la
 * servir du tout. Chaque appelant retombe déjà sur une valeur par défaut.
 */
const READ_TIMEOUT_MS = 2500;
const read = <T>(query: Promise<T>, label: string): Promise<T> =>
  withTimeout(query, READ_TIMEOUT_MS, label);

export interface Service {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  homepage: string | null;
  status_page_url: string;
  logo_domain: string | null;
  current_status: ServiceStatus;
  current_status_since: Date;
  last_incident_at: Date | null;
  incident_count_90d: number;
  uptime_90d: number | null;
  watcher_count: number;
}

export interface Incident {
  id: string;
  service_id: string;
  title: string;
  body: string | null;
  url: string | null;
  impact: string;
  state: string;
  is_resolved: boolean;
  started_at: Date;
  resolved_at: Date | null;
}

/** Fragment de colonnes réutilisable — évalué à l'appel, jamais à l'import. */
const serviceCols = () => sql`
  id, slug, name, category, description, homepage, status_page_url, logo_domain,
  current_status, current_status_since, last_incident_at, incident_count_90d,
  uptime_90d, watcher_count
`;

/** `cache` déduplique les appels au sein d'un même rendu (layout + page + metadata). */
export const getServiceBySlug = cache(async (slug: string): Promise<Service | null> => {
  if (isBuildPhase()) return null;
  const [row] = await read(
    sql<Service[]>`
      select ${serviceCols()} from services where slug = ${slug} and is_active limit 1
    `,
    `service:${slug}`,
  );
  return row ?? null;
});

export const getAllServices = cache(async (): Promise<Service[]> => {
  if (isBuildPhase()) return [];
  return read(
    sql<Service[]>`
      select ${serviceCols()} from services where is_active order by watcher_count desc, name asc
    `,
    "services",
  );
});

export async function getServiceSlugs(): Promise<{ slug: string; updated_at: Date }[]> {
  if (isBuildPhase()) return [];
  return sql<{ slug: string; updated_at: Date }[]>`
    select slug, updated_at from services where is_active order by slug
  `;
}

export async function getIncidents(serviceId: string, limit = 25): Promise<Incident[]> {
  if (isBuildPhase()) return [];
  return sql<Incident[]>`
    select id, service_id, title, body, url, impact, state, is_resolved, started_at, resolved_at
      from incidents
     where service_id = ${serviceId}
     order by started_at desc
     limit ${limit}
  `;
}

export async function getDailyUptime(
  serviceId: string,
  days = 90,
): Promise<{ day: string; uptime_pct: number; incident_count: number; downtime_minutes: number }[]> {
  if (isBuildPhase()) return [];
  const rows = await sql<
    { day: Date; uptime_pct: number; incident_count: number; downtime_minutes: number }[]
  >`
    select day, uptime_pct, incident_count, downtime_minutes
      from service_daily_uptime
     where service_id = ${serviceId} and day > current_date - ${days}::integer
     order by day asc
  `;
  return rows.map((r) => ({ ...r, day: new Date(r.day).toISOString().slice(0, 10) }));
}

export async function getCategories(): Promise<
  { category: string; count: number; degraded: number }[]
> {
  if (isBuildPhase()) return [];
  return sql`
    select category,
           count(*)::int as count,
           count(*) filter (where current_status <> 'operational')::int as degraded
      from services
     where is_active
     group by category
     order by count desc, category asc
  `;
}

export async function getServicesByCategory(category: string): Promise<Service[]> {
  if (isBuildPhase()) return [];
  return sql<Service[]>`
    select ${serviceCols()} from services
     where is_active and lower(category) = lower(${category})
     order by watcher_count desc, name asc
  `;
}

export async function getRecentIncidents(limit = 12): Promise<
  (Incident & { service_name: string; service_slug: string; logo_domain: string | null })[]
> {
  if (isBuildPhase()) return [];
  return read(
    sql`
      select i.id, i.service_id, i.title, i.body, i.url, i.impact, i.state, i.is_resolved,
             i.started_at, i.resolved_at,
             s.name as service_name, s.slug as service_slug, s.logo_domain
        from incidents i
        join services s on s.id = i.service_id
       where s.is_active and i.started_at > now() - interval '30 days'
       order by i.started_at desc
       limit ${limit}
    `,
    "incidents",
  );
}

export async function getGlobalStats(): Promise<{
  services: number;
  incidents_30d: number;
  degraded_now: number;
  watchers: number;
}> {
  if (isBuildPhase()) return { services: 0, incidents_30d: 0, degraded_now: 0, watchers: 0 };
  const [row] = await sql<any[]>`
    select (select count(*)::int from services where is_active) as services,
           (select count(*)::int from incidents where started_at > now() - interval '30 days') as incidents_30d,
           (select count(*)::int from services where is_active and current_status <> 'operational') as degraded_now,
           (select coalesce(sum(watcher_count),0)::int from services) as watchers
  `;
  return row;
}

/** Fournisseurs proches (même catégorie) : maillage interne pour le SEO. */
export async function getRelatedServices(
  category: string,
  excludeId: string,
  limit = 8,
): Promise<Service[]> {
  if (isBuildPhase()) return [];
  return sql<Service[]>`
    select ${serviceCols()} from services
     where is_active and category = ${category} and id <> ${excludeId}
     order by watcher_count desc, name asc
     limit ${limit}
  `;
}

// ---------------------------------------------------------------------------
// Tableau de bord
// ---------------------------------------------------------------------------
export async function getUserWatchlist(userId: string): Promise<
  (Service & { min_impact: string })[]
> {
  return sql`
    select s.id, s.slug, s.name, s.category, s.description, s.homepage, s.status_page_url,
           s.logo_domain, s.current_status, s.current_status_since, s.last_incident_at,
           s.incident_count_90d, s.uptime_90d, s.watcher_count, w.min_impact
      from watch_items w
      join services s on s.id = w.service_id
     where w.user_id = ${userId}
     order by s.current_status <> 'operational' desc, s.name asc
  `;
}

export async function getUserChannels(userId: string): Promise<
  { id: string; kind: string; target: string; is_active: boolean; last_error: string | null }[]
> {
  return sql`
    select id, kind, target, is_active, last_error
      from alert_channels where user_id = ${userId} order by created_at asc
  `;
}

export interface AlertHistoryRow {
  id: string;
  event_kind: string;
  status: string;
  sent_at: Date | null;
  created_at: Date;
  title: string;
  service_name: string;
  service_slug: string;
}

export async function getUserAlertHistory(userId: string, limit = 10) {
  return sql<AlertHistoryRow[]>`
    select d.id, d.event_kind, d.status, d.sent_at, d.created_at,
           i.title, s.name as service_name, s.slug as service_slug
      from alert_deliveries d
      join incidents i on i.id = d.incident_id
      join services s on s.id = i.service_id
     where d.user_id = ${userId}
     order by d.created_at desc
     limit ${limit}
  `;
}
