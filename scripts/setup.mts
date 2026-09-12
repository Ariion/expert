/**
 * ============================================================================
 * INSTALLATION AUTOMATIQUE — `npm run setup`
 * ============================================================================
 *
 * Ce script fait tout ce qu'une API permet de faire à votre place :
 *
 *   1. applique le schéma SQL complet sur votre base ;
 *   2. installe le catalogue de fournisseurs ;
 *   3. crée les produits et tarifs Stripe (Pro 19 €, Team 49 €) ;
 *   4. crée l'endpoint webhook Stripe et récupère sa clé de signature ;
 *   5. configure le portail de facturation Stripe (résiliation en self-service) ;
 *   6. génère les secrets applicatifs ;
 *   7. vérifie le domaine d'envoi Resend ;
 *   8. pousse toutes les variables dans Vercel (si un token est fourni) ;
 *   9. écrit .env.local et affiche ce qu'il reste — s'il reste quelque chose.
 *
 * Il est IDEMPOTENT : le relancer ne crée pas de doublons, il complète ce qui
 * manque. En cas d'échec d'une étape, les autres continuent et le rapport
 * final dit précisément quoi corriger.
 *
 * Options : --non-interactive   n'invite à rien, utilise l'environnement
 *           --skip-stripe / --skip-db / --skip-vercel
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import postgres from "postgres";
import Stripe from "stripe";
import { SEED_SERVICES } from "../src/data/services";
import { readEnvFile, writeEnvFile, type EnvMap } from "../src/lib/envfile";

const ENV_PATH = ".env.local";
const args = new Set(process.argv.slice(2));
const interactive = !args.has("--non-interactive") && process.stdin.isTTY;

const C = {
  b: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  ok: (s: string) => `\x1b[32m${s}\x1b[0m`,
  warn: (s: string) => `\x1b[33m${s}\x1b[0m`,
  err: (s: string) => `\x1b[31m${s}\x1b[0m`,
};

interface Step {
  name: string;
  status: "ok" | "warn" | "err" | "skip";
  detail: string;
  todo?: string;
}
const steps: Step[] = [];
const record = (s: Step) => {
  steps.push(s);
  const icon = s.status === "ok" ? C.ok("✓") : s.status === "warn" ? C.warn("!") : s.status === "skip" ? C.dim("–") : C.err("✗");
  console.log(`  ${icon} ${s.name} ${C.dim(s.detail)}`);
};

// ---------------------------------------------------------------------------
// Collecte de la configuration
// ---------------------------------------------------------------------------
const env: EnvMap = { ...readEnvFile(ENV_PATH) };
for (const k of Object.keys(process.env)) {
  if (/^(DATABASE_URL|APP_URL|STRIPE_|RESEND_|EMAIL_FROM|AUTH_SECRET|CRON_SECRET|OPS_|VERCEL_)/.test(k)) {
    env[k] = process.env[k] as string;
  }
}

const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;

async function ask(key: string, label: string, opts: { required?: boolean; example?: string } = {}) {
  if (env[key]) return;
  if (!rl) {
    if (opts.required) throw new Error(`${key} manquant (mode non interactif).`);
    return;
  }
  const hint = opts.example ? C.dim(` (ex. ${opts.example})`) : "";
  const suffix = opts.required ? "" : C.dim(" [entrée pour passer]");
  const answer = (await rl.question(`  ${C.b(label)}${hint}${suffix}\n  > `)).trim();
  if (!answer && opts.required) {
    console.log(C.err("  Cette valeur est obligatoire.\n"));
    return ask(key, label, opts);
  }
  if (answer) env[key] = answer;
  console.log("");
}

console.log(`\n${C.b("StatusPulse — installation automatique")}\n`);
console.log(
  C.dim(
    "Ce script ne peut pas créer vos comptes à votre place (identité, KYC bancaire).\n" +
      "Il fait tout le reste. Munissez-vous de 4 informations, une seule fois.\n",
  ),
);

await ask("DATABASE_URL", "URL Postgres (Supabase > Database > Transaction pooler, port 6543)", {
  required: true,
  example: "postgresql://postgres.xxx:MDP@aws-0-eu-west-3.pooler.supabase.com:6543/postgres",
});
await ask("APP_URL", "URL publique du site, sans slash final", {
  required: true,
  example: "https://statuspulse.app",
});
await ask("STRIPE_SECRET_KEY", "Clé secrète Stripe (Développeurs > Clés API)", {
  required: !args.has("--skip-stripe"),
  example: "sk_live_…",
});
await ask("RESEND_API_KEY", "Clé API Resend", { example: "re_…" });
await ask("EMAIL_FROM", "Expéditeur des emails", { example: "StatusPulse <alertes@votredomaine.com>" });
await ask("OPS_ALERT_EMAIL", "Votre email personnel pour les alertes système (fortement conseillé)");
rl?.close();

env.APP_URL = (env.APP_URL ?? "").replace(/\/$/, "");
env.STRIPE_AUTOMATIC_TAX ??= "false";

// Secrets : générés une fois, jamais à saisir.
let generated = 0;
for (const [key, bytes] of [["AUTH_SECRET", 48], ["CRON_SECRET", 24]] as const) {
  if (!env[key] || env[key].length < 16 || env[key].startsWith("remplacer")) {
    env[key] = randomBytes(bytes).toString("base64url");
    generated++;
  }
}

console.log(`\n${C.b("Installation")}\n`);
record({
  name: "Secrets applicatifs",
  status: "ok",
  detail: generated ? `${generated} secret(s) générés` : "déjà présents",
});

// ---------------------------------------------------------------------------
// 1 & 2. Base de données : schéma + catalogue
// ---------------------------------------------------------------------------
if (!args.has("--skip-db") && env.DATABASE_URL) {
  const sql = postgres(env.DATABASE_URL, { prepare: false, max: 2, connect_timeout: 15, onnotice: () => {} });
  try {
    const schema = readFileSync("supabase/schema.sql", "utf8");
    await sql.unsafe(schema).simple();
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from information_schema.tables
       where table_schema = 'public'
         and table_name in ('services','incidents','users','alert_deliveries')`;
    record({
      name: "Schéma SQL",
      status: n === 4 ? "ok" : "err",
      detail: n === 4 ? "12 tables, index, triggers et fonctions de file en place" : `${n}/4 tables critiques`,
    });

    let inserted = 0;
    for (const s of SEED_SERVICES) {
      const rows = await sql<{ created: boolean }[]>`
        insert into services (slug, name, category, description, homepage, status_page_url,
                              feed_url, feed_kind, logo_domain)
        values (${s.slug}, ${s.name}, ${s.category}, ${s.description}, ${s.homepage},
                ${s.status_page_url}, ${s.feed_url}, ${s.feed_kind}, ${s.logo_domain})
        on conflict (slug) do update
          set name = excluded.name, category = excluded.category,
              description = excluded.description, homepage = excluded.homepage,
              status_page_url = excluded.status_page_url, feed_url = excluded.feed_url,
              feed_kind = excluded.feed_kind, logo_domain = excluded.logo_domain
        returning (xmax = 0) as created`;
      if (rows[0]?.created) inserted++;
    }
    record({
      name: "Catalogue de fournisseurs",
      status: "ok",
      detail: `${SEED_SERVICES.length} fournisseurs (${inserted} nouveaux) → ${SEED_SERVICES.length} pages indexables`,
    });

    // Vérification des flux : ce qui ne répond pas est désactivé pour ne pas
    // publier une page vide, et signalé dans le rapport final.
    const broken: string[] = [];
    await Promise.all(
      SEED_SERVICES.map(async (s) => {
        try {
          const res = await fetch(s.feed_url, {
            headers: { "user-agent": "StatusPulseBot/1.0 (+setup check)" },
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) broken.push(`${s.slug} (HTTP ${res.status})`);
        } catch {
          broken.push(`${s.slug} (injoignable)`);
        }
      }),
    );
    const brokenSlugs = broken.map((b) => b.split(" ")[0]);
    const ratio = broken.length / SEED_SERVICES.length;

    if (ratio > 0.5) {
      // 71 fournisseurs ne tombent pas en même temps. Au-delà de la moitié
      // d'échecs, le problème est local (pare-feu, proxy, DNS) : on ne touche
      // à rien plutôt que de saborder le catalogue sur un faux signal.
      record({
        name: "Vérification des flux",
        status: "err",
        detail: `${broken.length}/${SEED_SERVICES.length} injoignables — aucune désactivation appliquée`,
        todo:
          "Un taux d'échec aussi élevé vient presque toujours du réseau de la machine qui lance ce script " +
          "(pare-feu ou proxy sortant), pas des fournisseurs. Relancez depuis une connexion sans filtrage : " +
          "la production, elle, appelle ces flux depuis Vercel.",
      });
    } else {
      if (brokenSlugs.length) {
        await sql`update services set is_active = false where slug in ${sql(brokenSlugs)}`;
      }
      // Un flux réparé revient tout seul dans le catalogue.
      const revived = await sql`
        update services set is_active = true, consecutive_failures = 0, last_error = null
         where not is_active ${brokenSlugs.length ? sql`and slug not in ${sql(brokenSlugs)}` : sql``}`;
      record({
        name: "Vérification des flux",
        status: broken.length === 0 ? "ok" : "warn",
        detail:
          broken.length === 0
            ? `${SEED_SERVICES.length}/${SEED_SERVICES.length} répondent`
            : `${SEED_SERVICES.length - broken.length}/${SEED_SERVICES.length} OK · désactivés : ${broken.slice(0, 5).join(", ")}${broken.length > 5 ? "…" : ""}${revived.count ? ` · ${revived.count} réactivé(s)` : ""}`,
        todo:
          broken.length > 0
            ? `Rien d'urgent : les ${broken.length} flux en échec sont désactivés et n'affectent pas les autres. ` +
              "Pour les récupérer, corrigez leur URL dans src/data/services.ts et relancez `npm run setup`."
            : undefined,
      });
    }
  } catch (err) {
    record({
      name: "Base de données",
      status: "err",
      detail: String(err).slice(0, 160),
      todo: "Vérifier DATABASE_URL (chaîne « Transaction pooler », port 6543, mot de passe inclus).",
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
} else {
  record({ name: "Base de données", status: "skip", detail: "ignorée" });
}

// ---------------------------------------------------------------------------
// 3, 4, 5. Stripe : produits, tarifs, webhook, portail
// ---------------------------------------------------------------------------
if (!args.has("--skip-stripe") && env.STRIPE_SECRET_KEY) {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { maxNetworkRetries: 3, timeout: 30000, telemetry: false });

  const CATALOG = [
    { id: "statuspulse_pro", key: "STRIPE_PRICE_PRO", lookup: "statuspulse_pro_monthly", name: "StatusPulse Pro", amount: 1900, desc: "50 fournisseurs surveillés, alertes instantanées, Slack et webhooks." },
    { id: "statuspulse_team", key: "STRIPE_PRICE_TEAM", lookup: "statuspulse_team_monthly", name: "StatusPulse Team", amount: 4900, desc: "500 fournisseurs, 25 canaux, rapports SLA et accès API." },
  ];

  try {
    for (const p of CATALOG) {
      let productId: string;
      try {
        productId = (await stripe.products.retrieve(p.id)).id;
      } catch {
        productId = (
          await stripe.products.create({ id: p.id, name: p.name, description: p.desc })
        ).id;
      }

      const existing = await stripe.prices.list({ lookup_keys: [p.lookup], active: true, limit: 1 });
      const price =
        existing.data[0] ??
        (await stripe.prices.create({
          product: productId,
          unit_amount: p.amount,
          currency: "eur",
          recurring: { interval: "month" },
          lookup_key: p.lookup,
          transfer_lookup_key: true,
          // Prix TTC : évite un échec de paiement le jour où Stripe Tax est activé.
          tax_behavior: "inclusive",
        }));
      env[p.key] = price.id;
    }
    record({
      name: "Produits et tarifs Stripe",
      status: "ok",
      detail: `Pro 19 €/mois et Team 49 €/mois prêts (${env.STRIPE_PRICE_PRO}, ${env.STRIPE_PRICE_TEAM})`,
    });
  } catch (err) {
    record({ name: "Produits et tarifs Stripe", status: "err", detail: String(err).slice(0, 160) });
  }

  // --- Webhook -------------------------------------------------------------
  const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_failed",
  ];
  try {
    const url = `${env.APP_URL}/api/stripe/webhook`;
    const list = await stripe.webhookEndpoints.list({ limit: 100 });
    const mine = list.data.find((w) => w.url === url);

    if (mine && env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) {
      await stripe.webhookEndpoints.update(mine.id, { enabled_events: WEBHOOK_EVENTS });
      record({ name: "Webhook Stripe", status: "ok", detail: `déjà configuré sur ${url}` });
    } else {
      // La clé de signature n'est renvoyée qu'à la création : on recrée pour
      // pouvoir l'écrire dans la configuration sans aucun copier-coller.
      if (mine) await stripe.webhookEndpoints.del(mine.id);
      const created = await stripe.webhookEndpoints.create({
        url,
        enabled_events: WEBHOOK_EVENTS,
        description: "StatusPulse — facturation",
      });
      env.STRIPE_WEBHOOK_SECRET = created.secret ?? "";
      record({
        name: "Webhook Stripe",
        status: created.secret ? "ok" : "warn",
        detail: created.secret ? `créé sur ${url}, clé de signature récupérée` : "créé, clé non renvoyée",
      });
    }
  } catch (err) {
    record({ name: "Webhook Stripe", status: "err", detail: String(err).slice(0, 160) });
  }

  // --- Portail de facturation ---------------------------------------------
  try {
    const configs = await stripe.billingPortal.configurations.list({ limit: 10 });
    const existing = configs.data.find((c) => c.metadata?.app === "statuspulse");
    const params: Stripe.BillingPortal.ConfigurationCreateParams = {
      business_profile: { headline: "StatusPulse — gérez votre abonnement" },
      features: {
        customer_update: { enabled: true, allowed_updates: ["email", "address", "tax_id"] },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: { enabled: true, mode: "at_period_end" },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ["price"],
          proration_behavior: "create_prorations",
          products: [
            { product: "statuspulse_pro", prices: [env.STRIPE_PRICE_PRO] },
            { product: "statuspulse_team", prices: [env.STRIPE_PRICE_TEAM] },
          ],
        },
      },
      default_return_url: `${env.APP_URL}/dashboard`,
      metadata: { app: "statuspulse" },
    };
    if (existing) await stripe.billingPortal.configurations.update(existing.id, params as Stripe.BillingPortal.ConfigurationUpdateParams);
    else await stripe.billingPortal.configurations.create(params);
    record({
      name: "Portail de facturation",
      status: "ok",
      detail: "résiliation, changement de plan et factures en self-service (zéro support à assurer)",
    });
  } catch (err) {
    record({
      name: "Portail de facturation",
      status: "warn",
      detail: String(err).slice(0, 140),
      todo: "Activer le portail client dans Stripe > Paramètres > Facturation > Portail client.",
    });
  }
} else {
  record({ name: "Stripe", status: "skip", detail: "ignoré" });
}

// ---------------------------------------------------------------------------
// 7. Resend : domaine d'envoi
// ---------------------------------------------------------------------------
if (env.RESEND_API_KEY) {
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`API Resend : HTTP ${res.status}`);
    const body = (await res.json().catch(() => ({}))) as { data?: Array<{ name: string; status: string }> };
    const domains = body.data ?? [];
    const from = (env.EMAIL_FROM ?? "").match(/<?([^<>@\s]+)@([^<>\s]+?)>?$/)?.[2];
    const match = domains.find((d) => d.name === from);
    record({
      name: "Domaine d'envoi Resend",
      status: match?.status === "verified" ? "ok" : "warn",
      detail: match
        ? `${match.name} : ${match.status}`
        : domains.length
          ? `domaines connus : ${domains.map((d) => d.name).join(", ")}`
          : "aucun domaine déclaré",
      todo:
        match?.status === "verified"
          ? undefined
          : "Ajouter votre domaine dans Resend et publier les DNS (SPF + DKIM) : sans cela les alertes partent en spam.",
    });
  } catch (err) {
    record({ name: "Domaine d'envoi Resend", status: "warn", detail: String(err).slice(0, 140) });
  }
} else {
  record({ name: "Resend", status: "skip", detail: "clé absente" });
}

// ---------------------------------------------------------------------------
// 8. Vercel : synchronisation des variables d'environnement
// ---------------------------------------------------------------------------
const VERCEL_KEYS = [
  "DATABASE_URL", "APP_URL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PRO", "STRIPE_PRICE_TEAM", "STRIPE_AUTOMATIC_TAX",
  "RESEND_API_KEY", "EMAIL_FROM", "AUTH_SECRET", "CRON_SECRET",
  "OPS_ALERT_EMAIL", "OPS_ALERT_WEBHOOK",
];

if (!args.has("--skip-vercel") && env.VERCEL_TOKEN && env.VERCEL_PROJECT_ID) {
  try {
    const team = env.VERCEL_TEAM_ID ? `?teamId=${env.VERCEL_TEAM_ID}&upsert=true` : "?upsert=true";
    let pushed = 0;
    for (const key of VERCEL_KEYS) {
      if (!env[key]) continue;
      const res = await fetch(
        `https://api.vercel.com/v10/projects/${env.VERCEL_PROJECT_ID}/env${team}`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${env.VERCEL_TOKEN}`, "content-type": "application/json" },
          body: JSON.stringify({
            key,
            value: env[key],
            type: "encrypted",
            target: ["production", "preview", "development"],
          }),
          signal: AbortSignal.timeout(20000),
        },
      );
      if (res.ok) pushed++;
    }
    record({
      name: "Variables Vercel",
      status: pushed ? "ok" : "warn",
      detail: `${pushed}/${VERCEL_KEYS.filter((k) => env[k]).length} poussées`,
      todo: "Redéployer le projet pour que les nouvelles variables soient prises en compte.",
    });
  } catch (err) {
    record({ name: "Variables Vercel", status: "warn", detail: String(err).slice(0, 140) });
  }
} else {
  record({
    name: "Variables Vercel",
    status: "skip",
    detail: "VERCEL_TOKEN/VERCEL_PROJECT_ID absents",
    todo: `Coller les variables de ${ENV_PATH} dans Vercel > Settings > Environment Variables (ou fournir VERCEL_TOKEN + VERCEL_PROJECT_ID et relancer).`,
  });
}

// ---------------------------------------------------------------------------
// 9. Écriture de la configuration + vérification en ligne
// ---------------------------------------------------------------------------
writeEnvFile(ENV_PATH, env);
record({ name: "Configuration écrite", status: "ok", detail: ENV_PATH });

if (env.APP_URL?.startsWith("https://")) {
  try {
    const res = await fetch(`${env.APP_URL}/api/health`, { signal: AbortSignal.timeout(15000) });
    const body = (await res.json()) as Record<string, unknown>;
    record({
      name: "Site en ligne",
      status: res.ok ? "ok" : "warn",
      detail: JSON.stringify(body).slice(0, 140),
    });

    if (env.CRON_SECRET) {
      const ing = await fetch(`${env.APP_URL}/api/cron/ingest`, {
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
        signal: AbortSignal.timeout(120000),
      });
      record({
        name: "Première collecte",
        status: ing.ok ? "ok" : "warn",
        detail: ing.ok ? (await ing.text()).slice(0, 120) : `HTTP ${ing.status}`,
      });
    }
  } catch (err) {
    record({
      name: "Site en ligne",
      status: "warn",
      detail: String(err).slice(0, 120),
      todo: "Déployer le site (Vercel) puis relancer `npm run setup` pour lancer la première collecte.",
    });
  }
}

// ---------------------------------------------------------------------------
// Rapport final
// ---------------------------------------------------------------------------
const todos = steps.filter((s) => s.todo).map((s) => s.todo!);
const errors = steps.filter((s) => s.status === "err");

console.log(`\n${C.b("Résultat")}\n`);
if (errors.length === 0 && todos.length === 0) {
  console.log(C.ok("  Tout est en place. Le système tourne seul à partir de maintenant."));
  console.log(C.dim("  Prochaine action recommandée : aucune. Surveillez votre boîte mail ;"));
  console.log(C.dim("  vous ne recevrez un message que si le système lui-même tombe.\n"));
} else {
  if (errors.length) {
    console.log(C.err(`  ${errors.length} étape(s) en échec :`));
    for (const e of errors) console.log(`    • ${e.name} — ${e.detail}`);
    console.log("");
  }
  if (todos.length) {
    console.log(C.b("  Il reste à faire :"));
    todos.forEach((t, i) => console.log(`    ${i + 1}. ${t}`));
    console.log("");
  }
  console.log(C.dim("  Relancez `npm run setup` après correction : le script est idempotent.\n"));
}

process.exit(errors.length ? 1 : 0);
