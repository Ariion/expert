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
  const parsed = schema.safeParse(process.env);
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

/** Lecture tolérante, utilisable pendant le build (retourne un fallback). */
export function envOr(key: keyof Env, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const APP_URL = () => envOr("APP_URL", "http://localhost:3000").replace(/\/$/, "");
export const SITE_NAME = "StatusPulse";
