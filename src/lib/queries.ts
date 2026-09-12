import { cache } from "react";
import { sql } from "./db";
import type { ServiceStatus } from "./feeds";

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
  const [row] = await sql<Service[]>`
    select ${serviceCols()} from services where slug = ${slug} and is_active limit 1
  `;
  return row ?? null;
});

export const getAllServices = cache(async (): Promise<Service[]> => {
  return sql<Service[]>`
    select ${serviceCols()} from services where is_active order by watcher_count desc, name asc
  `;
});

export async function getServiceSlugs(): Promise<{ slug: string; updated_at: Date }[]> {
  return sql<{ slug: string; updated_at: Date }[]>`
    select slug, updated_at from services where is_active order by slug
  `;
}

export async function getIncidents(serviceId: string, limit = 25): Promise<Incident[]> {
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
  return sql<Service[]>`
    select ${serviceCols()} from services
     where is_active and lower(category) = lower(${category})
     order by watcher_count desc, name asc
  `;
}

export async function getRecentIncidents(limit = 12): Promise<
  (Incident & { service_name: string; service_slug: string; logo_domain: string | null })[]
> {
  return sql`
    select i.id, i.service_id, i.title, i.body, i.url, i.impact, i.state, i.is_resolved,
           i.started_at, i.resolved_at,
           s.name as service_name, s.slug as service_slug, s.logo_domain
      from incidents i
      join services s on s.id = i.service_id
     where s.is_active and i.started_at > now() - interval '30 days'
     order by i.started_at desc
     limit ${limit}
  `;
}

export async function getGlobalStats(): Promise<{
  services: number;
  incidents_30d: number;
  degraded_now: number;
  watchers: number;
}> {
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

export async function getUserAlertHistory(userId: string, limit = 10) {
  return sql`
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
