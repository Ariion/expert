import { z } from "zod";

/**
 * Validation d'environnement paresseuse.
 *
 * Volontairement NON exécutée au moment de l'import : le build Next.js doit
 * pouvoir rendre les pages statiques sans secrets. La validation se déclenche
 * au premier accès runtime, et échoue bruyamment plutôt que silencieusement.
 */
const schema = z.object({
  DATABASE_URL: z.string().url(),
  APP_URL: z.string().url(),

  STRIPE_SECRET_KEY: z.string().min(10),
  STRIPE_WEBHOOK_SECRET: z.string().min(10),
  STRIPE_PRICE_PRO: z.string().min(3),
  STRIPE_PRICE_TEAM: z.string().min(3),

  RESEND_API_KEY: z.string().min(10),
  EMAIL_FROM: z.string().min(5),

  AUTH_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(16),

  OPS_ALERT_EMAIL: z.string().email().optional(),
  OPS_ALERT_WEBHOOK: z.string().url().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  // Les variables déclarées mais vides sont retirées avant validation : zod
  // doit voir « absente », pas « chaîne vide », pour produire un message juste.
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string" && v.trim()) cleaned[k] = v.trim();
  }
  cleaned.APP_URL = APP_URL();

  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(
      `Variables d'environnement invalides ou manquantes : ${missing}. ` +
        `Voir .env.example et la section « Variables d'environnement » du README.`,
    );
  }
  cached = parsed.data;
  return cached;
}

/**
 * Lecture tolérante, utilisable pendant le build.
 *
 * Une variable déclarée mais vide (cas courant : l'écran d'import de Vercel
 * crée les clés sans valeur) doit être traitée comme absente. Utiliser `??`
 * ici laisserait passer la chaîne vide et ferait échouer le build.
 */
export function envOr(key: keyof Env, fallback: string): string {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : fallback;
}

/**
 * URL publique canonique.
 *
 * Trois sources, dans l'ordre : la variable APP_URL si elle est exploitable,
 * puis le domaine que Vercel injecte lui-même dans chaque déploiement, et
 * enfin le développement local. Conséquence : le site est correct dès le
 * premier déploiement, avant même qu'APP_URL n'ait été renseignée.
 */
export const APP_URL = (): string => {
  const explicit = envOr("APP_URL", "").replace(/\/+$/, "");
  if (/^https?:\/\/[^\s/]+/.test(explicit)) return explicit;

  const fromVercel = (
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    ""
  ).trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (fromVercel) return `https://${fromVercel}`;

  return "http://localhost:3000";
};

export const SITE_NAME = "StatusPulse";
