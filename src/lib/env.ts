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

  // Identité de l'éditeur, affichée dans les mentions légales. Obligatoire en
  // France dès qu'un site vend, mais volontairement optionnelle ici : plutôt
  // aucune mention qu'une mention inventée. Le bloc n'apparaît que si le nom
  // et le numéro sont tous deux renseignés.
  LEGAL_PUBLISHER: z.string().min(2).optional(),
  LEGAL_REGISTRATION: z.string().min(4).optional(),
  LEGAL_CONTACT_EMAIL: z.string().email().optional(),
  LEGAL_ADDRESS: z.string().min(4).optional(),

  // Panneau /admin (un seul opérateur, pas de compte). Volontairement
  // optionnelle : tant qu'elle n'est pas renseignée, /admin répond « non
  // configuré » plutôt que de faire échouer la validation de tout le site —
  // la même leçon que pour LEGAL_* ci-dessus, apprise à ses dépens ailleurs.
  ADMIN_PASSWORD: z.string().min(8).optional(),

  // Pas un secret (visible dans le code source de chaque page) : une valeur
  // par défaut vit directement dans les layouts. Cette variable ne sert qu'à
  // la remplacer sans redéploiement de code, si une revérification l'exige.
  GOOGLE_SITE_VERIFICATION: z.string().min(10).optional(),
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

  // Une adresse collée depuis un tableau de bord d'hébergeur arrive souvent
  // sans protocole. La refuser ferait échouer le diagnostic et l'installation
  // pour un « https:// » manquant ; on complète ce qui se devine sans
  // ambiguïté, et on rejette toujours ce qui ne ressemble pas à une adresse.
  if (cleaned.APP_URL) cleaned.APP_URL = normalizeUrl(cleaned.APP_URL);
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
/** Complète le protocole manquant et retire les barres obliques finales. */
export function normalizeUrl(value: string): string {
  const clean = value.trim().replace(/\/+$/, "");
  if (!clean || /^https?:\/\//i.test(clean)) return clean;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/.*)?$/i.test(clean) ? `https://${clean}` : clean;
}

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

export const SITE_NAME = "Upstream Status";

export interface Publisher {
  name: string;
  registration: string;
  email?: string;
  address?: string;
}

/**
 * Éditeur du site, tel qu'il doit figurer dans les mentions légales.
 *
 * Lu dans l'environnement plutôt qu'écrit en dur : le produit n'appartient pas
 * au code, et l'identité qui le publie peut changer sans qu'on redéploie. Tant
 * que le nom et le numéro d'immatriculation ne sont pas renseignés, rien n'est
 * affiché — un site sans mention vaut mieux qu'un site avec une mention fausse.
 */
export function publisher(): Publisher | null {
  const name = envOr("LEGAL_PUBLISHER", "");
  const registration = envOr("LEGAL_REGISTRATION", "");
  if (!name || !registration) return null;
  return {
    name,
    registration,
    email: envOr("LEGAL_CONTACT_EMAIL", "") || undefined,
    address: envOr("LEGAL_ADDRESS", "") || undefined,
  };
}
