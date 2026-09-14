import { createHash } from "node:crypto";
import { sql } from "./db";
import { env } from "./env";

/**
 * Analytique interne : compte les visites sans jamais savoir qui visite.
 *
 * Aucune adresse IP n'est stockée. `visitorHash` en dérive une empreinte à
 * sens unique, salée par le jour courant : deux visites à un jour d'écart ne
 * se recoupent jamais, et l'empreinte du jour est irréversible même en cas de
 * fuite de la base — on ne peut pas remonter à l'adresse d'origine. C'est ce
 * qui permet à la page légale de continuer à dire « aucun cookie hors
 * session, aucun traceur publicitaire » sans mentir.
 */
export function visitorHash(ip: string, userAgent: string): string {
  const day = new Date().toISOString().slice(0, 10); // rotation quotidienne
  return createHash("sha256")
    .update(`${ip}|${userAgent.slice(0, 200)}|${day}|${env().AUTH_SECRET}`)
    .digest("hex")
    .slice(0, 32);
}

/** Première adresse d'une chaîne `x-forwarded-for` — celle du visiteur, pas du proxy. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

/** Nom d'hôte d'un référent externe, ou `null` (visite directe / même site). */
export function referrerHost(referrer: string, appHost: string): string | null {
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    return host && host !== appHost.replace(/^www\./, "") ? host : null;
  } catch {
    return null;
  }
}

export async function recordView(input: {
  visitorHash: string;
  path: string;
  locale: string;
  referrerHost: string | null;
}): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into page_views (visitor_hash, path, locale, referrer_host)
    values (${input.visitorHash}, ${input.path.slice(0, 300)}, ${input.locale}, ${input.referrerHost})
    returning id
  `;
  return row!.id;
}

/** Signal de présence : prolonge la durée mesurée de cette visite. */
export async function pingView(id: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await sql`update page_views set last_seen_at = now() where id = ${id}`;
}

export interface AnalyticsKpis {
  views: number;
  visitors: number;
  avgSeconds: number;
  bounceRate: number;
}

/** Visiteurs distincts vus dans les ~90 dernières secondes (2-3 battements manqués tolérés). */
export async function getLiveVisitors(): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select count(distinct visitor_hash)::int as n
      from page_views
     where last_seen_at > now() - interval '90 seconds'
  `;
  return row?.n ?? 0;
}

export async function getKpis(days: number): Promise<AnalyticsKpis> {
  const [row] = await sql<{ views: number; visitors: number; avg_seconds: number; bounces: number }[]>`
    select
      count(*)::int as views,
      count(distinct visitor_hash)::int as visitors,
      coalesce(avg(extract(epoch from (last_seen_at - created_at))), 0)::int as avg_seconds,
      count(*) filter (where last_seen_at = created_at)::int as bounces
      from page_views
     where created_at > now() - ${`${days} days`}::interval
  `;
  const views = row?.views ?? 0;
  return {
    views,
    visitors: row?.visitors ?? 0,
    avgSeconds: row?.avg_seconds ?? 0,
    bounceRate: views > 0 ? Math.round(((row?.bounces ?? 0) / views) * 100) : 0,
  };
}

export interface DayPoint {
  day: string; // YYYY-MM-DD
  views: number;
  visitors: number;
}

/** Série quotidienne, toujours complète : un jour sans visite vaut 0, pas une case absente. */
export async function getDailySeries(days: number): Promise<DayPoint[]> {
  const rows = await sql<DayPoint[]>`
    select to_char(d.day, 'YYYY-MM-DD') as day,
           coalesce(count(pv.id), 0)::int as views,
           coalesce(count(distinct pv.visitor_hash), 0)::int as visitors
      from generate_series(
             date_trunc('day', now()) - ${`${days - 1} days`}::interval,
             date_trunc('day', now()),
             interval '1 day'
           ) as d(day)
      left join page_views pv
        on date_trunc('day', pv.created_at) = d.day
     group by d.day
     order by d.day asc
  `;
  return rows;
}

export interface TopRow {
  key: string;
  views: number;
  visitors: number;
}

export async function getTopPages(days: number, limit = 10): Promise<TopRow[]> {
  return sql<TopRow[]>`
    select path as key, count(*)::int as views, count(distinct visitor_hash)::int as visitors
      from page_views
     where created_at > now() - ${`${days} days`}::interval
     group by path
     order by views desc
     limit ${limit}
  `;
}

export async function getTopReferrers(days: number, limit = 10): Promise<TopRow[]> {
  return sql<TopRow[]>`
    select referrer_host as key, count(*)::int as views, count(distinct visitor_hash)::int as visitors
      from page_views
     where created_at > now() - ${`${days} days`}::interval
       and referrer_host is not null
     group by referrer_host
     order by views desc
     limit ${limit}
  `;
}
