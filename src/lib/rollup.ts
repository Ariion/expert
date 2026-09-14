import { sql } from "./db";
import { digestEmail, sendEmail } from "./mail";
import { ops } from "./ops";
import { statusLabel } from "./format";
import { asLocale } from "./i18n";

/**
 * Recalcule la disponibilité journalière des 90 derniers jours.
 *
 * Tout est fait en une requête : Postgres découpe chaque incident par jour et
 * agrège. Pas de boucle applicative, pas de dérive possible entre le graphique
 * affiché et les incidents stockés — les deux viennent de la même source.
 */
export async function rebuildUptime(windowDays = 90): Promise<number> {
  const rows = await sql<{ service_id: string }[]>`
    with days as (
      select generate_series(current_date - ${windowDays - 1}::integer, current_date, interval '1 day')::date as day
    ),
    slices as (
      select i.service_id,
             d.day,
             i.impact,
             greatest(i.started_at, d.day::timestamptz)                                as slice_start,
             least(coalesce(i.resolved_at, now()), (d.day + 1)::timestamptz)           as slice_end
        from incidents i
        join days d
          on i.started_at < (d.day + 1)::timestamptz
         and coalesce(i.resolved_at, now()) > d.day::timestamptz
    ),
    agg as (
      select service_id,
             day,
             sum(case when impact in ('critical','major')
                      then extract(epoch from (slice_end - slice_start)) / 60 else 0 end) as down,
             sum(case when impact = 'minor'
                      then extract(epoch from (slice_end - slice_start)) / 60 else 0 end) as degraded,
             count(*) as incidents
        from slices
       where slice_end > slice_start
       group by service_id, day
    )
    insert into service_daily_uptime (service_id, day, downtime_minutes, degraded_minutes, incident_count, uptime_pct)
    select service_id,
           day,
           round(down)::int,
           round(degraded)::int,
           incidents::int,
           greatest(0, least(100, 100 - (down / 14.4)))
      from agg
    on conflict (service_id, day) do update
       set downtime_minutes = excluded.downtime_minutes,
           degraded_minutes = excluded.degraded_minutes,
           incident_count   = excluded.incident_count,
           uptime_pct       = excluded.uptime_pct
    returning service_id
  `;

  // Projection sur `services` : les pages SEO n'ont plus qu'une ligne à lire.
  await sql`
    update services s
       set incident_count_90d = coalesce(a.n, 0),
           uptime_90d = coalesce(a.pct, 100)
      from (
        select sv.id,
               (select count(*) from incidents i
                 where i.service_id = sv.id and i.started_at > now() - interval '90 days') as n,
               (select greatest(0, least(100, 100 - sum(u.downtime_minutes)::numeric / (90 * 14.4)))
                  from service_daily_uptime u
                 where u.service_id = sv.id and u.day > current_date - 90) as pct
          from services sv
      ) a
     where s.id = a.id
  `;

  return rows.length;
}

/**
 * Digest quotidien — réservé aux plans payants.
 * C'est le rappel de valeur qui fait tenir l'abonnement les mois sans panne.
 */
export async function sendDailyDigests(): Promise<number> {
  const users = await sql<{ id: string; email: string; locale: string }[]>`
    select id, email, locale from users
     where plan <> 'free'
       and digest_enabled
       and email_verified
       and unsubscribed_at is null
       and plan_status in ('active','trialing')
  `;

  let sent = 0;
  const date = new Date().toISOString().slice(0, 10);

  for (const user of users) {
    try {
      const rows = await sql<
        { name: string; slug: string; status: string; incidents: number; uptime: number }[]
      >`
        select s.name, s.slug, s.current_status as status,
               coalesce((select count(*) from incidents i
                          where i.service_id = s.id and i.started_at > now() - interval '1 day'), 0)::int as incidents,
               coalesce(s.uptime_90d, 100) as uptime
          from watch_items w
          join services s on s.id = w.service_id
         where w.user_id = ${user.id}
         order by s.current_status <> 'operational' desc, s.name asc
      `;
      if (rows.length === 0) continue;

      const locale = asLocale(user.locale);
      const tpl = digestEmail({
        date,
        locale,
        rows: rows.map((r) => ({
          ...r,
          status: statusLabel(r.status as Parameters<typeof statusLabel>[0], locale),
          uptime: Number(r.uptime),
        })),
      });
      await sendEmail({ to: user.email, ...tpl, tag: "digest" });
      sent++;
    } catch (err) {
      await ops.warn("digest", `Digest non envoyé à ${user.id} : ${String(err)}`);
    }
  }

  return sent;
}
