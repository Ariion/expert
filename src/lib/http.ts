import { NextResponse } from "next/server";
import { APP_URL } from "./env";
import { sql } from "./db";

/** Redirection 303 : un POST suivi d'un GET (pattern POST-Redirect-GET). */
export function redirectTo(path: string, params: Record<string, string> = {}): NextResponse {
  const url = new URL(path, APP_URL());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url.toString(), 303);
}

export function fail(path: string, message: string): NextResponse {
  // Pas d'encodage manuel : `searchParams.set` s'en charge, et un double
  // encodage afficherait des %25 à l'utilisateur.
  return redirectTo(path, { error: message });
}

export function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Garde-fou anti-abus sur l'envoi d'emails : pas plus de `max` liens de
 * connexion par utilisateur et par fenêtre. Empêche qu'une adresse serve de
 * cible de bombardement via nos formulaires publics.
 */
export async function tooManyTokens(userId: string, max = 4, minutes = 15): Promise<boolean> {
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from auth_tokens
     where user_id = ${userId} and created_at > now() - ${`${minutes} minutes`}::interval
  `;
  return (row?.n ?? 0) >= max;
}

/** Authentification des jobs cron (header Vercel ou secret explicite). */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("key") === secret;
}
