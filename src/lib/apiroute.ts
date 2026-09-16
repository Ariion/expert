import { NextResponse } from "next/server";
import { authenticateApiKey, type ApiCaller } from "./apikeys";
import { APP_URL } from "./env";

/**
 * Garde commune aux routes /api/v1/*.
 *
 * Volontairement sans en-tête CORS : cette API s'appelle depuis un serveur.
 * Autoriser le navigateur reviendrait à encourager de poser la clé dans du
 * code front, où n'importe quel visiteur peut la lire.
 *
 * Chaque refus dit précisément ce qui manque. Un 401 au corps vide se
 * diagnostique à l'aveugle, et c'est toujours au client qu'il coûte du temps.
 */
export async function requireApiCaller(
  req: Request,
): Promise<{ caller: ApiCaller } | { error: NextResponse }> {
  const caller = await authenticateApiKey(req);
  if (!caller) {
    return {
      error: NextResponse.json(
        {
          error: "unauthorized",
          message:
            "Clé d'API absente ou révoquée. Envoyez l'en-tête « Authorization: Bearer usk_… ».",
          docs: `${APP_URL()}/dashboard`,
        },
        { status: 401 },
      ),
    };
  }

  if (caller.plan !== "team") {
    return {
      error: NextResponse.json(
        {
          error: "plan_required",
          message: "L'accès API est inclus dans le plan Team.",
          current_plan: caller.plan,
          upgrade: `${APP_URL()}/pricing`,
        },
        { status: 403 },
      ),
    };
  }

  return { caller };
}

/** Borne un paramètre numérique de requête, sans jamais faire échouer l'appel. */
export function intParam(req: Request, name: string, fallback: number, min: number, max: number): number {
  const raw = new URL(req.url).searchParams.get(name);
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
