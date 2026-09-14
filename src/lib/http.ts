import { NextResponse } from "next/server";
import { APP_URL } from "./env";
import { sql } from "./db";
import { describeError, trackCron } from "./ops";
import { asLocale, href, type Locale } from "./i18n";

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

/**
 * Langue depuis laquelle le formulaire a été posté.
 *
 * Chaque formulaire du site transporte un champ `locale` caché. Sans lui, une
 * route d'API renverrait systématiquement vers la version française : un
 * visiteur anglophone qui s'abonne depuis /en/status/github se retrouverait sur
 * une page de connexion en français, juste après avoir donné son email.
 */
export function formLocale(form: FormData): Locale {
  return asLocale(str(form, "locale"));
}

/** Raccourci vers un chemin interne dans la langue du formulaire. */
export function localized(form: FormData, path: string): string {
  return href(formLocale(form), path);
}

/**
 * Chemin interne sûr. Une valeur postée qui ne commence pas par une seule barre
 * oblique pourrait rediriger hors du site (`//evil.example`) : on la refuse.
 */
export function safePath(value: string, fallback: string): string {
  return /^\/(?!\/)/.test(value) ? value : fallback;
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

/**
 * Exécution standard d'une tâche planifiée.
 *
 * Un échec renvoyait un 500 au corps vide : le planificateur voyait « HTTP 500 »
 * sans jamais pouvoir dire pourquoi, et il fallait aller lire les logs de la
 * plateforme d'hébergement. La raison est désormais dans la réponse, donc
 * directement dans le journal du workflow qui a déclenché la tâche.
 */
export async function runCron(
  job: string,
  fn: () => Promise<Record<string, unknown>>,
): Promise<NextResponse> {
  try {
    const stats = await trackCron(job, fn);
    return NextResponse.json({ ok: true, job, ...stats });
  } catch (err) {
    return NextResponse.json(
      { ok: false, job, error: describeError(err) },
      { status: 500 },
    );
  }
}
