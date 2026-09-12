import { createHmac } from "node:crypto";
import { sql } from "./db";
import { ops } from "./ops";
import { env, APP_URL, SITE_NAME } from "./env";
import { incidentEmail, sendEmail } from "./mail";

interface Delivery {
  id: string;
  user_id: string;
  channel_id: string;
  incident_id: string;
  event_kind: "opened" | "updated" | "resolved";
  payload: {
    service: { id: string; slug: string; name: string };
    incident: {
      id: string;
      title: string;
      body: string | null;
      url: string | null;
      impact: string;
      state: string;
      started_at: string;
    };
    kind: string;
  };
  attempts: number;
  kind: "email" | "webhook" | "slack";
  target: string;
  email: string;
}

const MAX_ATTEMPTS = 6;

/** Backoff exponentiel : 1, 4, 9, 16, 25 minutes. */
function backoffMinutes(attempts: number): number {
  return Math.min(attempts * attempts, 30);
}

function emoji(kind: string, impact: string): string {
  if (kind === "resolved") return "✅";
  return impact === "critical" ? "🔴" : impact === "major" ? "🟠" : "🟡";
}

async function deliverSlack(d: Delivery): Promise<void> {
  const { service, incident } = d.payload;
  const head = `${emoji(d.event_kind, incident.impact)} *${service.name}* — ${
    d.event_kind === "resolved" ? "incident résolu" : `incident ${incident.state}`
  }`;
  const res = await fetch(d.target, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      text: `${head}: ${incident.title}`,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: `${head}\n*${incident.title}*` } },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Impact : ${incident.impact} · Début : ${new Date(
                incident.started_at,
              ).toISOString()} · <${incident.url ?? `${APP_URL()}/status/${service.slug}`}|détail> · <${APP_URL()}/status/${service.slug}|historique>`,
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Slack ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function deliverWebhook(d: Delivery): Promise<void> {
  const body = JSON.stringify({
    event: `incident.${d.event_kind}`,
    delivered_at: new Date().toISOString(),
    service: d.payload.service,
    incident: d.payload.incident,
  });
  // Signature HMAC : le destinataire peut vérifier l'origine du payload.
  const signature = createHmac("sha256", env().AUTH_SECRET).update(body).digest("hex");

  const res = await fetch(d.target, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": `${SITE_NAME}-webhook/1.0`,
      "x-statuspulse-event": `incident.${d.event_kind}`,
      "x-statuspulse-signature": `sha256=${signature}`,
    },
    body,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Webhook ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function deliverEmail(d: Delivery): Promise<void> {
  const { service, incident } = d.payload;
  const tpl = incidentEmail({
    serviceName: service.name,
    serviceSlug: service.slug,
    title: incident.title,
    impact: incident.impact,
    state: incident.state,
    kind: d.event_kind,
    url: incident.url,
    body: incident.body,
    startedAt: new Date(incident.started_at).toUTCString(),
  });
  await sendEmail({ to: d.target || d.email, ...tpl, tag: "incident-alert" });
}

/**
 * Vide la file d'alertes.
 *
 * Chaque livraison est indépendante : un webhook client mort ne bloque jamais
 * les emails des autres. Les échecs repartent en file avec backoff ; au bout de
 * 6 tentatives la livraison passe en `dead` et l'incident système est signalé.
 */
export async function runDispatch(batchSize = 120, concurrency = 10) {
  const claimed = await sql<Delivery[]>`
    with claimed as (
      select * from claim_alert_deliveries(${batchSize})
    )
    select c.id, c.user_id, c.channel_id, c.incident_id, c.event_kind, c.payload, c.attempts,
           ch.kind, ch.target, u.email
      from claimed c
      join alert_channels ch on ch.id = c.channel_id
      join users u on u.id = c.user_id
  `;

  let sent = 0;
  let failed = 0;
  const queue = [...claimed];

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (let d = queue.shift(); d; d = queue.shift()) {
      try {
        if (d.kind === "slack") await deliverSlack(d);
        else if (d.kind === "webhook") await deliverWebhook(d);
        else await deliverEmail(d);

        await sql`update alert_deliveries set status = 'sent', sent_at = now(), last_error = null where id = ${d.id}`;
        await sql`update alert_channels set failure_count = 0, last_error = null, last_success_at = now() where id = ${d.channel_id}`;
        sent++;
      } catch (err) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        const dead = d.attempts >= MAX_ATTEMPTS;

        await sql`
          update alert_deliveries
             set status = ${dead ? "dead" : "pending"},
                 last_error = ${message.slice(0, 500)},
                 locked_at = null,
                 scheduled_at = ${dead ? sql`scheduled_at` : sql`now() + ${`${backoffMinutes(d.attempts)} minutes`}::interval`}
           where id = ${d.id}
        `.catch(() => {});

        const [ch] = await sql<{ failure_count: number }[]>`
          update alert_channels
             set failure_count = failure_count + 1, last_error = ${message.slice(0, 500)}
           where id = ${d.channel_id}
           returning failure_count
        `;

        // Un canal mort (URL supprimée, boîte pleine) est désactivé au bout de
        // 15 échecs : on cesse de brûler des tentatives dessus.
        if (ch && ch.failure_count >= 15) {
          await sql`update alert_channels set is_active = false where id = ${d.channel_id}`;
          await ops.warn("dispatch", `Canal ${d.kind} désactivé après 15 échecs`, {
            channel_id: d.channel_id,
          });
        }

        if (dead) {
          await ops.critical(
            "dispatch",
            `Alerte abandonnée après ${MAX_ATTEMPTS} tentatives (${d.kind}) : ${message}`,
            { delivery_id: d.id, channel_kind: d.kind, user_id: d.user_id },
            `delivery-dead:${d.kind}`,
          );
        }
      }
    }
  });

  await Promise.all(workers);
  return { claimed: claimed.length, sent, failed };
}
