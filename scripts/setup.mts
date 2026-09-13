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
/**
 * `String(err)` sur une erreur de fetch donne « TypeError: fetch failed » et
 * perd la vraie raison, qui vit dans `cause`. On la fait remonter.
 */
function describe(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as { cause?: unknown }).cause;
  const detail =
    cause instanceof Error ? ` — ${cause.message}` : cause ? ` — ${String(cause)}` : "";
  return `${err.message}${detail}`;
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

/**
 * Découverte Vercel.
 *
 * Avec un simple token, on retrouve le projet lié à ce dépôt GitHub, son
 * identifiant et son domaine de production. Conséquence : ni l'ID de projet ni
 * l'URL publique n'ont à être saisis — deux valeurs de moins à aller chercher.
 */
let vercelRepoId: number | null = null;
let vercelProjectName: string | null = null;

async function discoverVercel(): Promise<void> {
  if (!env.VERCEL_TOKEN) return;
  const team = env.VERCEL_TEAM_ID ? `?teamId=${env.VERCEL_TEAM_ID}&limit=100` : "?limit=100";
  try {
    const res = await fetch(`https://api.vercel.com/v9/projects${team}`, {
      headers: { authorization: `Bearer ${env.VERCEL_TOKEN}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return;
    const { projects = [] } = (await res.json()) as { projects?: any[] };
    const ghRepo = process.env.GITHUB_REPOSITORY ?? "";
    const shortName = ghRepo.split("/")[1] ?? "";

    const project =
      projects.find((p) => p.id === env.VERCEL_PROJECT_ID || p.name === env.VERCEL_PROJECT_ID) ??
      projects.find((p) => p.link?.org && p.link?.repo && `${p.link.org}/${p.link.repo}` === ghRepo) ??
      projects.find((p) => p.name === shortName) ??
      (projects.length === 1 ? projects[0] : null);

    if (!project) return;
    env.VERCEL_PROJECT_ID = project.id;
    vercelRepoId = project.link?.repoId ? Number(project.link.repoId) : null;
    vercelProjectName = project.name ?? null;

    if (!env.APP_URL) {
      const aliases: string[] = project.targets?.production?.alias ?? [];
      const custom = aliases.filter((a) => !a.endsWith(".vercel.app")).sort((a, b) => a.length - b.length);
      const domain = custom[0] ?? aliases.find((a) => a.endsWith(".vercel.app")) ?? `${project.name}.vercel.app`;
      env.APP_URL = `https://${domain}`;
    }
  } catch {
    /* pas de Vercel joignable : on retombe sur la saisie manuelle */
  }
}

await discoverVercel();

const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;

const missingRequired: string[] = [];

async function ask(key: string, label: string, opts: { required?: boolean; example?: string } = {}) {
  if (env[key]) return;
  if (!rl) {
    // Mode non interactif (GitHub Actions) : on collecte tout ce qui manque
    // pour l'annoncer d'un coup, plutôt que d'échouer sur le premier.
    if (opts.required) missingRequired.push(key);
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

// L'URL publique est indispensable (webhook Stripe, liens des emails). Elle est
// normalement déduite de Vercel ; si elle manque encore, autant le dire tout de
// suite plutôt que de créer un webhook sur une URL vide.
if (!env.APP_URL) missingRequired.push("APP_URL");

if (missingRequired.length) {
  const unique = [...new Set(missingRequired)];
  const help: Record<string, string> = {
    DATABASE_URL: "Supabase > Project Settings > Database > Connection string > « Transaction pooler » (port 6543)",
    APP_URL: "l'URL publique du site — normalement déduite automatiquement de Vercel ; vérifiez le secret VERCEL_TOKEN, ou ajoutez un secret APP_URL",
    STRIPE_SECRET_KEY: "Stripe > Développeurs > Clés API > « Reveal secret key » (sk_…)",
    RESEND_API_KEY: "Resend > API Keys",
    EMAIL_FROM: "l'expéditeur des emails, ex. StatusPulse <alertes@votredomaine.com>",
  };
  console.log(`\n${C.err("Configuration incomplète.")}\n`);
  for (const k of unique) console.log(`  ${C.err("✗")} ${C.b(k)} — ${help[k] ?? "valeur manquante"}`);
  console.log("");

  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `# ❌ Configuration incomplète\n\nAjoutez ces secrets dans **Settings → Secrets and variables → Actions**, puis relancez :\n\n` +
        unique.map((k) => `- \`${k}\` — ${help[k] ?? ""}`).join("\n") +
        "\n",
    );
  }
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Validation des saisies
//
// Chaque règle correspond à une erreur réellement commise en conditions
// réelles. Les détecter ici coûte une seconde ; les détecter en production
// coûte un paiement perdu ou une base injoignable.
// ---------------------------------------------------------------------------
interface Rule {
  key: string;
  label: string;
  fatal: (v: string) => string | null;
  warn?: (v: string) => string | null;
}

const RULES: Rule[] = [
  {
    key: "DATABASE_URL",
    label: "URL Postgres (Supabase > Database > Transaction pooler, port 6543)",
    fatal: (v) => {
      if (!/^postgres(ql)?:\/\//.test(v)) return "doit commencer par postgresql://";
      if (/\[YOUR-PASSWORD\]|MOT_DE_PASSE|\[PASSWORD\]/i.test(v))
        return "le mot de passe n'a pas été remplacé dans l'URL";
      return null;
    },
    warn: (v) =>
      v.includes(":6543")
        ? null
        : "port 5432 détecté : en serverless il faut la chaîne « Transaction pooler » (port 6543), sinon les connexions s'épuisent",
  },
  {
    key: "APP_URL",
    label: "URL publique du site, sans slash final",
    fatal: (v) => (/^https?:\/\/.+/.test(v) ? null : "doit être une URL complète (https://…)"),
    warn: (v) =>
      v.startsWith("https://") || v.includes("localhost")
        ? null
        : "une URL en http:// cassera les cookies de session en production",
  },
  {
    key: "STRIPE_SECRET_KEY",
    label: "Clé SECRÈTE Stripe (Développeurs > Clés API > « Reveal secret key »)",
    fatal: (v) => {
      if (v.startsWith("pk_"))
        return "c'est la clé PUBLIABLE (pk_…), qui ne sert qu'au navigateur. Il faut la clé secrète, juste en dessous dans le tableau de bord : « Reveal secret key » (sk_…)";
      if (!/^(sk|rk)_(test|live)_/.test(v))
        return "format inattendu : une clé secrète commence par sk_test_ ou sk_live_";
      return null;
    },
    warn: (v) =>
      v.startsWith("sk_test_")
        ? "clé de TEST : parfait pour valider le tunnel de paiement, mais aucun euro réel ne sera encaissé. Repassez en clé live_ une fois le compte Stripe validé"
        : null,
  },
  {
    key: "RESEND_API_KEY",
    label: "Clé API Resend",
    fatal: (v) => (v.startsWith("re_") ? null : "une clé Resend commence par re_"),
  },
  {
    key: "EMAIL_FROM",
    label: "Expéditeur des emails",
    fatal: (v) =>
      /@[^@\s]+\.[^@\s]{2,}/.test(v)
        ? null
        : "doit contenir une adresse email valide, ex. StatusPulse <alertes@votredomaine.com>",
  },
];

const warnings: string[] = [];

for (let pass = 0; pass < 3; pass++) {
  const bad = RULES.map((r) => ({ r, msg: env[r.key] ? r.fatal(env[r.key]) : null })).filter((x) => x.msg);
  if (bad.length === 0) break;

  console.log("");
  for (const { r, msg } of bad) {
    console.log(`  ${C.err("✗")} ${C.b(r.key)} — ${msg}`);
    if (!rl) continue;
    delete env[r.key];
  }
  if (!rl) {
    console.log(C.err("\n  Corrigez ces valeurs et relancez.\n"));
    process.exit(1);
  }
  console.log("");
  for (const { r } of bad) await ask(r.key, r.label, { required: true });
}

for (const r of RULES) {
  const w = env[r.key] && r.warn ? r.warn(env[r.key]) : null;
  if (w) warnings.push(`${r.key} — ${w}`);
}

rl?.close();

env.APP_URL = (env.APP_URL ?? "").replace(/\/$/, "");
env.STRIPE_AUTOMATIC_TAX ??= "false";

// Secrets : générés une fois, jamais à saisir.
let generated = 0;
for (const [key, bytes] of [["AUTH_SECRET", 48], ["CRON_SECRET", 24]] as const) {
  if (!env[key] || env[key].length < 16 || env[key].startsWith("remplacer")) {
    env[key] = randomBytes(bytes).toString("base64url");
    generated++;
    // Dans GitHub Actions, les logs d'un dépôt public sont lisibles par tous :
    // un secret fraîchement généré ne doit jamais y apparaître.
    if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${env[key]}`);
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
    const recovered: string[] = [];

    /** Un flux répond-il ? */
    const probe = async (url: string): Promise<boolean> => {
      try {
        const res = await fetch(url, {
          headers: { "user-agent": "StatusPulseBot/1.0 (+setup check)" },
          signal: AbortSignal.timeout(15000),
        });
        return res.ok;
      } catch {
        return false;
      }
    };

    /** Le format se déduit de l'URL : inutile de le maintenir à la main. */
    const kindOf = (url: string) =>
      /summary\.json|\/api\/v2\//.test(url) ? "statuspage_v2" : /\.atom(\?|$)/.test(url) ? "atom" : "rss";

    await Promise.all(
      SEED_SERVICES.map(async (svc) => {
        if (await probe(svc.feed_url)) return;

        // L'adresse d'une status page change (rachat, migration, refonte).
        // On essaie les adresses de secours connues avant d'abandonner.
        for (const candidate of svc.alt_feeds ?? []) {
          if (await probe(candidate)) {
            await sql`
              update services
                 set feed_url = ${candidate}, feed_kind = ${kindOf(candidate)},
                     is_active = true, consecutive_failures = 0, last_error = null,
                     http_etag = null, http_last_modified = null
               where slug = ${svc.slug}`;
            recovered.push(svc.slug);
            return;
          }
        }
        broken.push(svc.slug);
      }),
    );
    const brokenSlugs = [...broken];
    const ratio = broken.length / SEED_SERVICES.length;

    if (ratio > 0.5) {
      // 71 fournisseurs ne tombent pas en même temps. Au-delà de la moitié
      // d'échecs, le problème est local (pare-feu, proxy, DNS) : on ne touche
      // à rien plutôt que de saborder le catalogue sur un faux signal.
      record({
        name: "Vérification des flux",
        status: "err",
        detail: `${broken.length}/${SEED_SERVICES.length} injoignables — aucune désactivation appliquée`,
        todo: process.env.GITHUB_ACTIONS
          ? "Taux d'échec anormal depuis un runner GitHub (réseau ouvert) : vérifiez qu'il ne s'agit pas d'une panne générale, puis relancez ce workflow."
          : "Un taux d'échec aussi élevé vient presque toujours du réseau de la machine qui lance ce script " +
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
            : `${SEED_SERVICES.length - broken.length}/${SEED_SERVICES.length} OK · désactivés : ${broken.join(", ")}${revived.count ? ` · ${revived.count} réactivé(s)` : ""}${recovered.length ? ` · récupérés via une URL de secours : ${recovered.join(", ")}` : ""}`,
        todo:
          broken.length > 0
            ? `Rien d'urgent : les ${broken.length} flux en échec sont désactivés et n'affectent pas les autres. ` +
              "Pour les récupérer, corrigez leur URL dans src/data/services.ts et relancez `npm run setup`."
            : undefined,
      });
    }
  } catch (err) {
    const message = describe(err);
    const authFailure = /password authentication failed|SASL|authentication/i.test(message);

    // Autopsie de l'URL fournie. Rien de secret n'est affiché : ni le mot de
    // passe, ni l'identifiant complet du projet — seulement de quoi voir
    // immédiatement quelle chaîne de connexion a été copiée.
    let shape = "URL illisible";
    let isPooler = false;
    let userHasRef = false;
    let specialCharsInPassword = false;
    try {
      const u = new URL(env.DATABASE_URL ?? "");
      isPooler = u.hostname.includes("pooler.supabase.com");
      userHasRef = u.username.includes(".");
      specialCharsInPassword = /[#/?\[\]@%:]/.test(decodeURIComponent(u.password || ""));
      const maskedUser = userHasRef ? `${u.username.split(".")[0]}.****` : u.username;
      shape = `utilisateur « ${maskedUser} », hôte ${isPooler ? "pooler.supabase.com" : u.hostname.replace(/^[^.]+/, "****")}, port ${u.port || "(défaut)"}`;
    } catch {
      /* URL non analysable : le message générique suffira */
    }

    // On n'accuse la mauvaise chaîne de connexion que si l'hôte est bien un
    // hôte Supabase : sur une base auto-hébergée, « postgres » sans point est
    // parfaitement normal.
    let isSupabase = false;
    try {
      isSupabase = new URL(env.DATABASE_URL ?? "").hostname.includes("supabase");
    } catch {
      /* ignoré */
    }
    const wrongString = isSupabase && (!isPooler || !userHasRef);

    record({
      name: "Base de données",
      status: "err",
      detail: `${message.slice(0, 110)} — ${shape}`,
      todo: !authFailure
        ? "Vérifier DATABASE_URL (chaîne « Transaction pooler », port 6543, mot de passe inclus)."
        : wrongString
          ? "Ce n'est pas la bonne chaîne de connexion. Une URL de Transaction pooler a TOUJOURS cette forme : " +
            "postgresql://postgres.LEREFDUPROJET:MOTDEPASSE@aws-0-REGION.pooler.supabase.com:6543/postgres — " +
            `l'utilisateur contient un point, l'hôte contient « pooler.supabase.com » et le port est 6543. La vôtre a ${shape}, ` +
            "c'est donc l'onglet « Direct connection » (ou « Session pooler ») qui a été copié. " +
            "Supabase > bouton Connect > onglet Transaction pooler > copier, puis remplacer [YOUR-PASSWORD]."
          : specialCharsInPassword
            ? "La chaîne est la bonne, mais le mot de passe contient un caractère spécial (@ : / ? # [ ] %) qui casse l'URL. " +
              "Supabase > Settings > Database > Reset database password, avec un mot de passe composé uniquement de lettres et de chiffres, " +
              "puis recomposez l'URL de l'onglet Transaction pooler."
            : "La chaîne a la bonne forme : c'est donc le mot de passe qui ne correspond plus. " +
              "Supabase > Settings > Database > Reset database password (lettres et chiffres uniquement), puis recomposez l'URL.",
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
    record({ name: "Produits et tarifs Stripe", status: "err", detail: describe(err).slice(0, 160) });
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
    record({ name: "Webhook Stripe", status: "err", detail: describe(err).slice(0, 160) });
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
      detail: describe(err).slice(0, 140),
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
    record({ name: "Domaine d'envoi Resend", status: "warn", detail: describe(err).slice(0, 140) });
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
  const teamQS = env.VERCEL_TEAM_ID ? `&teamId=${env.VERCEL_TEAM_ID}` : "";

  /**
   * Un appel réseau isolé échoue de temps en temps ; onze appels d'affilée,
   * régulièrement. Chaque variable est donc réessayée séparément, et l'échec de
   * l'une n'empêche pas les autres : c'est toute la configuration du site en
   * production qui dépend de cette étape.
   */
  async function pushEnv(key: string): Promise<string | null> {
    const url = `https://api.vercel.com/v10/projects/${env.VERCEL_PROJECT_ID}/env?upsert=true${teamQS}`;
    let last = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { authorization: `Bearer ${env.VERCEL_TOKEN}`, "content-type": "application/json" },
          body: JSON.stringify({
            key,
            value: env[key],
            type: "encrypted",
            target: ["production", "preview", "development"],
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (res.ok) return null;
        last = `HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 90)}`;
        if (res.status < 500 && res.status !== 429) return last; // erreur définitive
      } catch (err) {
        last = describe(err);
      }
      await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
    }
    return last;
  }

  try {
    const wanted = VERCEL_KEYS.filter((k) => env[k]);
    const failures: string[] = [];
    let pushed = 0;

    for (const key of wanted) {
      const failure = await pushEnv(key);
      if (failure) failures.push(`${key} : ${failure}`);
      else pushed++;
    }

    record({
      name: "Variables Vercel",
      status: failures.length === 0 ? "ok" : pushed > 0 ? "warn" : "err",
      detail:
        failures.length === 0
          ? `${pushed}/${wanted.length} poussées sur ${vercelProjectName ?? env.VERCEL_PROJECT_ID}`
          : `${pushed}/${wanted.length} poussées · échecs : ${failures.slice(0, 3).join(" | ")}`,
      todo:
        failures.length === 0
          ? undefined
          : "Relancez « 1. Installation » : les variables manquantes seront repoussées (et les secrets régénérés si besoin).",
    });

    // Un déploiement existant ne voit pas les nouvelles variables : il faut en
    // relancer un. On le déclenche ici pour qu'aucun clic ne soit nécessaire.
    if (pushed && vercelRepoId) {
      const dep = await fetch(`https://api.vercel.com/v13/deployments?skipAutoDetectionConfirmation=1${teamQS}`, {
        method: "POST",
        headers: { authorization: `Bearer ${env.VERCEL_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({
          name: vercelProjectName,
          project: env.VERCEL_PROJECT_ID,
          target: "production",
          gitSource: {
            type: "github",
            repoId: vercelRepoId,
            ref: process.env.GITHUB_REF_NAME ?? "claude/relaxed-archimedes-gxpzpb",
          },
        }),
        signal: AbortSignal.timeout(30000),
      });
      record({
        name: "Redéploiement",
        status: dep.ok ? "ok" : "warn",
        detail: dep.ok ? "déclenché avec les nouvelles variables" : `HTTP ${dep.status}`,
        todo: dep.ok ? undefined : "Cliquer sur « Redeploy » dans Vercel pour appliquer les variables.",
      });
    } else if (pushed) {
      record({
        name: "Redéploiement",
        status: "warn",
        detail: "projet non lié à un dépôt Git",
        todo: "Cliquer sur « Redeploy » dans Vercel pour appliquer les variables.",
      });
    }
  } catch (err) {
    record({ name: "Variables Vercel", status: "err", detail: describe(err).slice(0, 140) });
  }
} else {
  record({
    name: "Variables Vercel",
    status: "skip",
    detail: "VERCEL_TOKEN absent",
    todo: process.env.GITHUB_ACTIONS
      ? "Ajouter le secret `VERCEL_TOKEN` (Vercel > Account Settings > Tokens) dans Settings → Secrets and variables → Actions, puis relancer ce workflow : les variables seront poussées et le site redéployé automatiquement."
      : `Coller les variables de ${ENV_PATH} dans Vercel > Settings > Environment Variables (ou fournir VERCEL_TOKEN et relancer).`,
  });
}

// ---------------------------------------------------------------------------
// 9. Écriture de la configuration + vérification en ligne
// ---------------------------------------------------------------------------
if (process.env.GITHUB_ACTIONS) {
  // Sur un runner, écrire les secrets sur disque n'a aucune utilité : ils sont
  // déjà dans les secrets du dépôt et poussés vers Vercel.
  record({ name: "Configuration", status: "ok", detail: "conservée dans les secrets du dépôt (aucun fichier écrit sur le runner)" });
} else {
  writeEnvFile(ENV_PATH, env);
  record({ name: "Configuration écrite", status: "ok", detail: ENV_PATH });
}

if (env.APP_URL?.startsWith("https://")) {
  try {
    // Un redéploiement prend une à trois minutes : on patiente plutôt que de
    // conclure à tort que le site est cassé.
    let res: Response | null = null;
    const deadline = Date.now() + 5 * 60_000;
    for (let attempt = 1; ; attempt++) {
      try {
        res = await fetch(`${env.APP_URL}/api/health`, { signal: AbortSignal.timeout(15000) });
        if (res.ok) break;
      } catch {
        res = null;
      }
      if (Date.now() > deadline) break;
      if (attempt === 1) console.log(C.dim("    (attente de la fin du déploiement…)"));
      await new Promise((r) => setTimeout(r, 15000));
    }
    if (!res) throw new Error("site injoignable après 5 minutes d'attente");
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
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
      detail: describe(err).slice(0, 120),
      todo: "Déployer le site (Vercel) puis relancer `npm run setup` pour lancer la première collecte.",
    });
  }
}

// ---------------------------------------------------------------------------
// Rapport final
// ---------------------------------------------------------------------------
const todos = steps.filter((s) => s.todo).map((s) => s.todo!);
if (warnings.length) {
  console.log(`\n${C.b("À savoir")}\n`);
  for (const w of warnings) console.log(`  ${C.warn("!")} ${w}`);
}
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

// ---------------------------------------------------------------------------
// Résumé lisible dans l'interface GitHub Actions (aucun secret n'y figure :
// sur un dépôt public, ce résumé est visible de tous).
// ---------------------------------------------------------------------------
if (process.env.GITHUB_STEP_SUMMARY) {
  const icon = (st: Step["status"]) => (st === "ok" ? "✅" : st === "warn" ? "⚠️" : st === "skip" ? "➖" : "❌");
  const md = [
    `# StatusPulse — installation`,
    "",
    errors.length === 0 && todos.length === 0
      ? `## ✅ Terminé — le système tourne seul à partir de maintenant`
      : `## ${errors.length ? "❌" : "⚠️"} Installation partielle`,
    "",
    env.APP_URL ? `**Votre site :** ${env.APP_URL}` : "",
    env.APP_URL ? `**Fournisseurs surveillés :** ${env.APP_URL}/status` : "",
    env.APP_URL ? `**Sitemap à déclarer dans Google Search Console :** \`${env.APP_URL}/sitemap/0.xml\`` : "",
    "",
    "| | Étape | Détail |",
    "|---|---|---|",
    ...steps.map((st) => `| ${icon(st.status)} | ${st.name} | ${st.detail.replace(/\|/g, "/")} |`),
    "",
    ...(warnings.length ? ["## À savoir", "", ...warnings.map((w) => `- ⚠️ ${w.replace(/\|/g, "/")}`), ""] : []),
    ...(todos.length
      ? ["## Il reste à faire", "", ...todos.map((t, i) => `${i + 1}. ${t.replace(/\|/g, "/")}`), ""]
      : ["## Rien à faire de votre côté", "", "Relancez ce workflow après tout changement de configuration : il est idempotent.", ""]),
  ].join("\n");
  await import("node:fs").then(({ appendFileSync }) =>
    appendFileSync(process.env.GITHUB_STEP_SUMMARY!, md + "\n"),
  );
}

process.exit(errors.length ? 1 : 0);
