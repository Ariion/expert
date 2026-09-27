import { sql } from "./db";
import { digestEmail, sendEmail, slaReportEmail } from "./mail";
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

/**
 * Rapport SLA mensuel — plan Team.
 *
 * Greffé sur la tâche nocturne plutôt que sur une tâche planifiée dédiée :
 * une cinquième entrée à configurer chez l'hébergeur de cron serait une
 * occasion de plus de se tromper, et une panne de plus à diagnostiquer. La
 * tâche tourne chaque nuit, ce code ne fait quelque chose qu'une fois par mois.
 *
 * `last_sla_report_at` garantit l'unicité : rejouer la tâche, ou la voir
 * s'exécuter deux fois le 1er du mois, n'envoie pas deux rapports. Un client
 * qui reçoit deux fois le même email doute de tout le reste.
 *
 * Valeur réelle de cette fonctionnalité : elle rappelle chaque mois ce que
 * l'abonnement a détecté. Un outil qu'on voit travailler est un outil qu'on
 * ne résilie pas — et le rapport se transfère tel quel à une direction qui
 * demande à quoi sert la ligne budgétaire.
 */
export async function sendMonthlySlaReports(now = new Date()): Promise<number> {
  // Bornes du mois ÉCOULÉ, en UTC comme tout le reste du produit.
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  const users = await sql<{ id: string; email: string; locale: string }[]>`
    select id, email, locale from users
     where plan = 'team'
       and email_verified
       and unsubscribed_at is null
       and plan_status in ('active','trialing')
       and (last_sla_report_at is null or last_sla_report_at < ${end})
  `;

  let sent = 0;
  for (const user of users) {
    try {
      const rows = await sql<
        { name: string; uptime: number; incidents: number; downtime: number; worst: number | null }[]
      >`
        select s.name,
               coalesce(agg.incidents, 0)::int as incidents,
               coalesce(agg.downtime, 0)::numeric as downtime,
               agg.worst::numeric as worst,
               greatest(0, 100 - (coalesce(agg.downtime, 0) / ${
                 (end.getTime() - start.getTime()) / 60000
               } * 100))::numeric as uptime
          from watch_items w
          join services s on s.id = w.service_id
          left join lateral (
            select count(*)::int as incidents,
                   sum(extract(epoch from (
                     least(coalesce(i.resolved_at, ${end}), ${end})
                     - greatest(i.started_at, ${start})
                   )) / 60) as downtime,
                   max(extract(epoch from (
                     least(coalesce(i.resolved_at, ${end}), ${end})
                     - greatest(i.started_at, ${start})
                   )) / 60) as worst
              from incidents i
             where i.service_id = s.id
               and i.impact <> 'maintenance'
               and i.started_at < ${end}
               and coalesce(i.resolved_at, ${end}) > ${start}
          ) agg on true
         where w.user_id = ${user.id}
         order by coalesce(agg.downtime, 0) desc, s.name asc
      `;
      if (rows.length === 0) continue;

      const locale = asLocale(user.locale);
      const period = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(start);

      const tpl = slaReportEmail({
        period,
        locale,
        rows: rows.map((r) => ({
          name: r.name,
          uptime: Number(r.uptime),
          incidents: r.incidents,
          downtimeMinutes: Number(r.downtime),
          worstMinutes: r.worst === null ? null : Number(r.worst),
        })),
      });
      await sendEmail({ to: user.email, ...tpl, tag: "sla-report" });
      await sql`update users set last_sla_report_at = now() where id = ${user.id}`;
      sent++;
    } catch (err) {
      await ops.warn("sla", `Rapport SLA non envoyé à ${user.id} : ${String(err)}`);
    }
  }

  return sent;
}
