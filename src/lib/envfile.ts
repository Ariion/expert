import { existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Lecture/écriture d'un fichier .env — partagé par les scripts d'installation
 * et de diagnostic. Aucune dépendance externe : un parseur de 20 lignes suffit
 * et évite un paquet de plus à maintenir.
 */
export type EnvMap = Record<string, string>;

export function readEnvFile(path: string): EnvMap {
  if (!existsSync(path)) return {};
  const out: EnvMap = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

/** Charge un .env dans process.env sans écraser ce qui existe déjà. */
export function loadEnvFiles(paths = [".env.local", ".env"]): void {
  for (const p of paths) {
    for (const [k, v] of Object.entries(readEnvFile(p))) {
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const ORDER = [
  "DATABASE_URL",
  "APP_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_TEAM",
  "STRIPE_AUTOMATIC_TAX",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "AUTH_SECRET",
  "CRON_SECRET",
  "OPS_ALERT_EMAIL",
  "OPS_ALERT_WEBHOOK",
  "VERCEL_TOKEN",
  "VERCEL_PROJECT_ID",
  "VERCEL_TEAM_ID",
];

export function writeEnvFile(path: string, values: EnvMap): void {
  const keys = [...ORDER.filter((k) => values[k] !== undefined), ...Object.keys(values).filter((k) => !ORDER.includes(k))];
  const body = keys.map((k) => `${k}="${values[k] ?? ""}"`).join("\n");
  writeFileSync(
    path,
    `# Généré par « npm run setup » — ne pas committer (ignoré par .gitignore).\n` +
      `# Ces mêmes valeurs doivent exister dans Vercel > Settings > Environment Variables.\n\n` +
      body +
      "\n",
    { mode: 0o600 },
  );
}
