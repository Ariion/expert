import { cookies } from "next/headers";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env, envOr } from "./env";

/**
 * Session du panneau /admin.
 *
 * Volontairement sans table en base : un seul opérateur, pas de comptes à
 * gérer, pas de révocation à distance à prévoir. Le cookie porte sa propre
 * preuve — une signature HMAC sur son échéance, avec le secret déjà utilisé
 * pour les sessions client (`AUTH_SECRET`) — donc rien à stocker ni à
 * nettoyer. Falsifier le cookie exige de connaître ce secret.
 */
export const ADMIN_COOKIE = "sp_admin";
const SESSION_HOURS = 12;

function sign(expires: number): string {
  return createHmac("sha256", env().AUTH_SECRET).update(`admin|${expires}`).digest("base64url");
}

function packToken(expires: number): string {
  return `${expires}.${sign(expires)}`;
}

function unpackToken(token: string): number | null {
  const [expiresRaw, signature] = token.split(".");
  if (!expiresRaw || !signature) return null;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires)) return null;

  const expected = Buffer.from(sign(expires));
  const got = Buffer.from(signature);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  if (expires < Date.now()) return null;
  return expires;
}

/** `null` : mot de passe non configuré (variable absente) plutôt que mauvais. */
export function adminConfigured(): boolean {
  return envOr("ADMIN_PASSWORD", "").length > 0;
}

export function verifyAdminPassword(candidate: string): boolean {
  const expected = envOr("ADMIN_PASSWORD", "");
  if (!expected || !candidate) return false;
  // Comparaison de deux empreintes de longueur fixe plutôt que des chaînes
  // elles-mêmes : `timingSafeEqual` exige des tampons de même taille, et une
  // simple longueur différente ne doit ni planter ni raccourcir le temps de
  // réponse (ce qui révélerait la longueur attendue).
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function createAdminSession(): Promise<void> {
  const expires = Date.now() + SESSION_HOURS * 3600_000;
  // Chemin "/" et non "/admin" : les routes qui vérifient ce cookie vivent
  // aussi sous /api/admin/*, hors de la portée d'un cookie scopé à /admin.
  (await cookies()).set(ADMIN_COOKIE, packToken(expires), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function isAdminSession(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  return unpackToken(token) !== null;
}

export async function destroyAdminSession(): Promise<void> {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/" });
}
