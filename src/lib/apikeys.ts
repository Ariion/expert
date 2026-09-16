import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { sql } from "./db";
import { env } from "./env";
import { planFor, type PlanId } from "./plans";

/**
 * Clés d'API — accès en lecture, réservé au plan Team.
 *
 * Même principe que les jetons de session : seule l'empreinte va en base. Une
 * fuite de la table `api_keys` ne permet donc d'appeler aucune API, et la clé
 * elle-même n'est affichée qu'une fois, à sa création. La retrouver ensuite
 * est impossible, y compris pour nous — c'est ce qui permet de promettre
 * honnêtement qu'elle n'est stockée nulle part en clair.
 */
const PREFIX = "usk_";
/** Plafond par compte : une clé compromise se remplace, elle ne s'accumule pas. */
export const MAX_KEYS = 5;

function hashKey(key: string): string {
  return createHash("sha256").update(`${key}${env().AUTH_SECRET}`).digest("hex");
}

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  created_at: Date;
  last_used_at: Date | null;
}

export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  return sql<ApiKeyRow[]>`
    select id, name, prefix, created_at, last_used_at
      from api_keys
     where user_id = ${userId} and revoked_at is null
     order by created_at desc
  `;
}

/** Renvoie la clé EN CLAIR : c'est le seul instant où elle existe hors du navigateur. */
export async function createApiKey(userId: string, name: string): Promise<string | null> {
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from api_keys where user_id = ${userId} and revoked_at is null
  `;
  if (n >= MAX_KEYS) return null;

  const key = `${PREFIX}${randomBytes(24).toString("base64url")}`;
  await sql`
    insert into api_keys (user_id, name, key_hash, prefix)
    values (${userId}, ${name.slice(0, 60) || "Clé API"}, ${hashKey(key)}, ${key.slice(0, 12)})
  `;
  return key;
}

export async function revokeApiKey(userId: string, id: string): Promise<void> {
  await sql`
    update api_keys set revoked_at = now()
     where id = ${id} and user_id = ${userId} and revoked_at is null
  `;
}

export interface ApiCaller {
  userId: string;
  plan: PlanId;
  locale: string;
}

/**
 * Authentifie un appel d'API à partir de l'en-tête `Authorization`.
 *
 * Le plan est relu à CHAQUE appel plutôt que porté par la clé : un compte
 * rétrogradé perd l'accès immédiatement, sans qu'il faille révoquer quoi que
 * ce soit à la main.
 */
export async function authenticateApiKey(req: Request): Promise<ApiCaller | null> {
  const header = req.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!key.startsWith(PREFIX) || key.length < 20) return null;

  const hash = hashKey(key);
  const [row] = await sql<{ id: string; key_hash: string; user_id: string; plan: string; locale: string }[]>`
    select k.id, k.key_hash, k.user_id, u.plan, u.locale
      from api_keys k
      join users u on u.id = k.user_id
     where k.key_hash = ${hash} and k.revoked_at is null
     limit 1
  `;
  if (!row) return null;

  const a = Buffer.from(row.key_hash);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  // Écriture volontairement non attendue : elle ne doit pas ralentir l'appel,
  // et sa perte occasionnelle ne coûte qu'une date d'usage approximative.
  void sql`update api_keys set last_used_at = now() where id = ${row.id}`.catch(() => {});

  return { userId: row.user_id, plan: planFor(row.plan).id, locale: row.locale };
}
