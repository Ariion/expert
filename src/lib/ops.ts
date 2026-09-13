import { asJson, sql } from "./db";
import { env, APP_URL, SITE_NAME } from "./env";

type Level = "info" | "warn" | "critical";

/**
 * Message d'erreur exploitable : `String(err)` perd la cause, qui est
 * justement l'information utile pour une erreur réseau ou Postgres.
 */
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as { cause?: unknown }).cause;
  const detail = cause instanceof Error ? ` — ${cause.message}` : cause ? ` — ${String(cause)}` : "";
  const code = (err as { code?: string }).code;
  return `${code ? `[${code}] ` : ""}${err.message}${detail}`;
}

/** Bucket horaire : une même panne ne spamme pas l'alerte plus d'une fois/heure. */
function hourBucket(): string {
  return new Date().toISOString().slice(0, 13);
}

async function notifyHumans(message: string, context: Record<string, unknown>) {
  const e = (() => {
    try {
      return env();
    } catch {
      return null;
    }
  })();
  if (!e) return;

  const body = `🚨 ${SITE_NAME} — incident système\n\n${message}\n\n${JSON.stringify(
    context,
    null,
    2,
  )}\n\n${APP_URL()}/api/health`;

  const jobs: Promise<unknown>[] = [];

  if (e.OPS_ALERT_WEBHOOK) {
    jobs.push(
      fetch(e.OPS_ALERT_WEBHOOK, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: body }),
        signal: AbortSignal.timeout(8000),
      }).catch(() => {}),
    );
  }

  if (e.OPS_ALERT_EMAIL) {
    jobs.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${e.RESEND_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: e.EMAIL_FROM,
          to: [e.OPS_ALERT_EMAIL],
          subject: `🚨 ${SITE_NAME} : ${message.slice(0, 80)}`,
          text: body,
        }),
        signal: AbortSignal.timeout(8000),
      }).catch(() => {}),
    );
  }

  await Promise.allSettled(jobs);
}

/**
 * Journalisation opérationnelle.
 *
 * Ne lève JAMAIS : un échec de log ne doit pas faire tomber un job. Les
 * événements `critical` déclenchent en plus une notification humaine
 * (webhook Slack + email), dédupliquée à l'heure.
 */
async function record(
  level: Level,
  source: string,
  message: string,
  context: Record<string, unknown> = {},
  dedupe?: string,
) {
  const line = `[${level}] ${source}: ${message}`;
  if (level === "critical") console.error(line, context);
  else if (level === "warn") console.warn(line, context);
  else console.log(line, context);

  const dedupeKey = `${source}:${dedupe ?? message.slice(0, 120)}:${hourBucket()}`;

  try {
    const rows = await sql<{ id: string }[]>`
      insert into ops_events (level, source, dedupe_key, message, context)
      values (${level}, ${source}, ${dedupeKey}, ${message}, ${asJson(context)})
      on conflict (dedupe_key) do nothing
      returning id
    `;
    // rows vide => déjà signalé dans la fenêtre courante, on ne renotifie pas.
    if (level === "critical" && rows.length > 0) {
      await notifyHumans(message, context);
      await sql`update ops_events set notified_at = now() where id = ${rows[0].id}`;
    }
  } catch (err) {
    console.error("[ops] persistance impossible", err);
    // Dernier recours : si la base est morte, on prévient quand même.
    if (level === "critical") await notifyHumans(message, { ...context, dbError: String(err) });
  }
}

export const ops = {
  info: (source: string, message: string, ctx?: Record<string, unknown>) =>
    record("info", source, message, ctx),
  warn: (source: string, message: string, ctx?: Record<string, unknown>) =>
    record("warn", source, message, ctx),
  critical: (source: string, message: string, ctx?: Record<string, unknown>, dedupe?: string) =>
    record("critical", source, message, ctx, dedupe),
};

/** Enregistre le cycle de vie d'un job cron (santé observable + watchdog). */
export async function trackCron<T extends Record<string, unknown>>(
  job: string,
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  let runId: string | null = null;
  try {
    const [row] = await sql<{ id: string }[]>`
      insert into cron_runs (job) values (${job}) returning id
    `;
    runId = row.id;
  } catch {
    /* la base est peut-être indisponible : on tente quand même le job */
  }

  try {
    const stats = await fn();
    if (runId) {
      await sql`
        update cron_runs
           set finished_at = now(), ok = true,
               stats = ${asJson({ ...stats, ms: Date.now() - started })}
         where id = ${runId}
      `;
    }
    return stats;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (runId) {
      await sql`
        update cron_runs set finished_at = now(), ok = false, error = ${message}
         where id = ${runId}
      `.catch(() => {});
    }
    await ops.critical("cron", `Job ${job} en échec : ${message}`, { job }, `cron-fail:${job}`);
    throw err;
  }
}
