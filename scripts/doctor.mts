/**
 * DIAGNOSTIC — `npm run doctor`
 *
 * Photographie complète du système en une commande : base, collecteur, file
 * d'alertes, flux fournisseurs, Stripe, email, site en ligne, SEO.
 * À lancer si un doute surgit — ou jamais, si aucune alerte n'arrive.
 */
import postgres from "postgres";
import Stripe from "stripe";
import { loadEnvFiles } from "../src/lib/envfile";

loadEnvFiles();

const C = {
  b: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  ok: (s: string) => `\x1b[32m${s}\x1b[0m`,
  warn: (s: string) => `\x1b[33m${s}\x1b[0m`,
  err: (s: string) => `\x1b[31m${s}\x1b[0m`,
};

let problems = 0;
function line(status: "ok" | "warn" | "err", label: string, detail: string) {
  if (status !== "ok") problems++;
  const icon = status === "ok" ? C.ok("✓") : status === "warn" ? C.warn("!") : C.err("✗");
  console.log(`  ${icon} ${label.padEnd(28)} ${C.dim(detail)}`);
}

const ago = (d: Date | string | null) =>
  d ? `${Math.round((Date.now() - new Date(d).getTime()) / 60000)} min` : "jamais";

console.log(`\n${C.b("StatusPulse — diagnostic")}\n`);

// --- Base de données --------------------------------------------------------
console.log(C.b("Base de données"));
if (!process.env.DATABASE_URL) {
  line("err", "Connexion", "DATABASE_URL absent");
} else {
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2, connect_timeout: 15, onnotice: () => {} });
  try {
    const [counts] = await sql<any[]>`
      select (select count(*)::int from services where is_active)                      as services,
             (select count(*)::int from services where not is_active)                  as inactifs,
             (select count(*)::int from services where consecutive_failures >= 3)      as flux_ko,
             (select count(*)::int from incidents)                                     as incidents,
             (select count(*)::int from incidents where not is_resolved)               as en_cours,
             (select count(*)::int from users)                                         as comptes,
             (select count(*)::int from users where email_verified)                    as verifies,
             (select count(*)::int from users where plan <> 'free')                    as payants,
             (select count(*)::int from alert_deliveries where status = 'pending')      as en_file,
             (select count(*)::int from alert_deliveries where status = 'dead')         as abandonnees,
             (select count(*)::int from alert_deliveries where status = 'sent')         as envoyees`;
    line("ok", "Connexion", "établie");
    line(counts.services > 0 ? "ok" : "err", "Catalogue", `${counts.services} actifs, ${counts.inactifs} désactivés`);
    line(counts.flux_ko === 0 ? "ok" : "warn", "Flux en échec", `${counts.flux_ko} fournisseur(s)`);
    line("ok", "Incidents", `${counts.incidents} collectés, ${counts.en_cours} en cours`);
    line("ok", "Comptes", `${counts.comptes} inscrits, ${counts.verifies} vérifiés, ${C.b(String(counts.payants))} payants`);
    line(counts.abandonnees === 0 ? "ok" : "warn", "Alertes", `${counts.envoyees} envoyées, ${counts.en_file} en file, ${counts.abandonnees} abandonnées`);

    console.log(`\n${C.b("Automatisation")}`);
    const jobs = await sql<any[]>`
      select job, max(finished_at) filter (where ok) as last_ok,
             count(*) filter (where not ok and started_at > now() - interval '1 day') as echecs
        from cron_runs group by job`;
    const expected: Record<string, number> = { ingest: 15, dispatch: 15, rollup: 1500, reconcile: 1500 };
    for (const job of ["ingest", "dispatch", "rollup", "reconcile"]) {
      const row = jobs.find((j) => j.job === job);
      const minutes = row?.last_ok ? (Date.now() - new Date(row.last_ok).getTime()) / 60000 : Infinity;
      line(
        minutes <= expected[job] ? "ok" : row ? "err" : "warn",
        `Job « ${job} »`,
        row ? `dernier succès il y a ${ago(row.last_ok)}, ${row.echecs} échec(s)/24 h` : "jamais exécuté",
      );
    }

    const events = await sql<any[]>`
      select level, count(*)::int as n from ops_events
       where created_at > now() - interval '24 hours' group by level`;
    const crit = events.find((e) => e.level === "critical")?.n ?? 0;
    line(crit === 0 ? "ok" : "err", "Alertes système 24 h", crit ? `${crit} critique(s)` : "aucune");

    const recent = await sql<any[]>`
      select level, source, message, created_at from ops_events
       where level in ('warn','critical') order by created_at desc limit 5`;
    if (recent.length) {
      console.log(C.dim("\n  Derniers évènements :"));
      for (const r of recent) console.log(C.dim(`    [${r.level}] ${r.source} — ${r.message.slice(0, 90)}`));
    }
    await sql.end({ timeout: 5 });
  } catch (err) {
    line("err", "Connexion", String(err).slice(0, 120));
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

// --- Stripe -----------------------------------------------------------------
console.log(`\n${C.b("Encaissement")}`);
if (!process.env.STRIPE_SECRET_KEY) {
  line("err", "Stripe", "STRIPE_SECRET_KEY absent");
} else {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 20000, telemetry: false });
  try {
    const prices = await stripe.prices.list({
      lookup_keys: ["statuspulse_pro_monthly", "statuspulse_team_monthly"],
      active: true,
    });
    line(prices.data.length === 2 ? "ok" : "err", "Tarifs", `${prices.data.length}/2 actifs`);

    const hooks = await stripe.webhookEndpoints.list({ limit: 100 });
    const mine = hooks.data.find((h) => h.url === `${process.env.APP_URL}/api/stripe/webhook`);
    line(mine?.status === "enabled" ? "ok" : "err", "Webhook", mine ? `${mine.status}, ${mine.enabled_events.length} évènements` : "absent");

    const subs = await stripe.subscriptions.list({ status: "active", limit: 100 });
    const mrr = subs.data.reduce((a, s) => a + (s.items.data[0]?.price.unit_amount ?? 0), 0) / 100;
    line("ok", "Abonnements actifs", `${subs.data.length} — MRR ${mrr.toFixed(2)} €`);
  } catch (err) {
    line("err", "Stripe", String(err).slice(0, 120));
  }
}

// --- Email ------------------------------------------------------------------
console.log(`\n${C.b("Email")}`);
if (!process.env.RESEND_API_KEY) {
  line("err", "Resend", "RESEND_API_KEY absent");
} else {
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`API Resend : HTTP ${res.status}`);
    const body = (await res.json().catch(() => ({}))) as { data?: Array<{ name: string; status: string }> };
    const from = (process.env.EMAIL_FROM ?? "").match(/<?([^<>@\s]+)@([^<>\s]+?)>?$/)?.[2];
    const d = body.data?.find((x) => x.name === from);
    line(d?.status === "verified" ? "ok" : "err", "Domaine d'envoi", d ? `${d.name} : ${d.status}` : `${from ?? "?"} non déclaré`);
  } catch (err) {
    line("err", "Resend", String(err).slice(0, 120));
  }
}

// --- Site et SEO ------------------------------------------------------------
console.log(`\n${C.b("Site et référencement")}`);
const base = process.env.APP_URL;
if (!base) {
  line("err", "APP_URL", "absent");
} else {
  try {
    const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(15000) });
    const body = (await health.json()) as any;
    line(health.ok ? "ok" : "err", "Santé", `${body.status} — ${body.services} services, collecte il y a ${ago(body.last_ingest)}`);
  } catch (err) {
    line("err", "Santé", String(err).slice(0, 120));
  }
  try {
    const sm = await fetch(`${base}/sitemap/0.xml`, { signal: AbortSignal.timeout(20000) });
    const xml = await sm.text();
    const urls = (xml.match(/<url>/g) ?? []).length;
    line(urls > 10 ? "ok" : "err", "Sitemap", `${urls} URLs indexables`);
  } catch (err) {
    line("err", "Sitemap", String(err).slice(0, 120));
  }
}

console.log(
  problems === 0
    ? `\n${C.ok("Aucun problème détecté. Rien à faire.")}\n`
    : `\n${C.warn(`${problems} point(s) à regarder ci-dessus.`)}\n`,
);
process.exit(problems ? 1 : 0);
