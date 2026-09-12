import { cookies, headers } from "next/headers";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { sql } from "./db";
import { env, APP_URL } from "./env";
import { magicLinkEmail, sendEmail } from "./mail";
import type { PlanId } from "./plans";

export const SESSION_COOKIE = "sp_session";
const SESSION_DAYS = 60;
const LOGIN_TOKEN_MINUTES = 30;

export interface SessionUser {
  id: string;
  email: string;
  plan: PlanId;
  plan_status: string;
  stripe_customer_id: string | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  email_verified: boolean;
  digest_enabled: boolean;
}

/** On ne stocke jamais un token en clair : seule son empreinte va en base. */
function hashToken(token: string): string {
  return createHash("sha256").update(`${token}${env().AUTH_SECRET}`).digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  const e = normalizeEmail(raw);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254;
}

/** Idempotent : un lead qui revient n'est jamais dupliqué. */
export async function findOrCreateUser(
  rawEmail: string,
  opts: { source?: string; serviceId?: string | null } = {},
): Promise<{ id: string; email: string; created: boolean }> {
  const email = normalizeEmail(rawEmail);
  const [existing] = await sql<{ id: string; email: string }[]>`
    select id, email from users where lower(email) = ${email} limit 1
  `;
  if (existing) return { ...existing, created: false };

  const [created] = await sql<{ id: string; email: string }[]>`
    insert into users (email, signup_source, signup_service_id)
    values (${email}, ${opts.source ?? "direct"}, ${opts.serviceId ?? null})
    on conflict (lower(email)) do update set updated_at = now()
    returning id, email
  `;
  return { ...created, created: true };
}

/** Génère un lien magique et l'envoie. Le token n'existe qu'en transit. */
export async function sendLoginLink(userId: string, email: string, next?: string): Promise<void> {
  const token = newToken();
  await sql`
    insert into auth_tokens (user_id, token_hash, expires_at)
    values (${userId}, ${hashToken(token)}, now() + ${`${LOGIN_TOKEN_MINUTES} minutes`}::interval)
  `;
  const url = `${APP_URL()}/api/auth/verify?token=${token}${
    next ? `&next=${encodeURIComponent(next)}` : ""
  }`;
  const tpl = magicLinkEmail(url);
  await sendEmail({ to: email, ...tpl, tag: "magic-link" });
}

/** Consomme le token (usage unique, comparaison à temps constant). */
export async function consumeLoginToken(token: string): Promise<string | null> {
  if (!token || token.length < 20) return null;
  const hash = hashToken(token);
  const [row] = await sql<{ id: string; user_id: string; token_hash: string }[]>`
    select id, user_id, token_hash from auth_tokens
     where token_hash = ${hash} and used_at is null and expires_at > now()
     limit 1
  `;
  if (!row) return null;
  const a = Buffer.from(row.token_hash);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  await sql`update auth_tokens set used_at = now() where id = ${row.id}`;
  await sql`update users set email_verified = true, last_seen_at = now() where id = ${row.user_id}`;
  return row.user_id;
}

export async function createSession(userId: string): Promise<void> {
  const token = newToken();
  const ua = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await sql`
    insert into sessions (user_id, token_hash, expires_at, user_agent)
    values (${userId}, ${hashToken(token)}, now() + ${`${SESSION_DAYS} days`}::interval, ${ua})
  `;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const [row] = await sql<SessionUser[]>`
      select u.id, u.email, u.plan, u.plan_status, u.stripe_customer_id,
             u.current_period_end, u.cancel_at_period_end, u.email_verified, u.digest_enabled
        from sessions s
        join users u on u.id = s.user_id
       where s.token_hash = ${hashToken(token)} and s.expires_at > now()
       limit 1
    `;
    return row ?? null;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await sql`delete from sessions where token_hash = ${hashToken(token)}`.catch(() => {});
  jar.delete(SESSION_COOKIE);
}
