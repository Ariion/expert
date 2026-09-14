import { NextResponse } from "next/server";
import { APP_URL } from "@/lib/env";
import { clientIp, recordView, referrerHost, visitorHash } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Balise de vue de page. Appelée une fois par chargement par `Analytics.tsx`.
 * Ne renvoie jamais d'erreur bloquante : un échec ici ne doit jamais empêcher
 * l'affichage de la page qui l'a appelée.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      path?: string;
      locale?: string;
      referrer?: string;
    };
    const path = typeof body.path === "string" ? body.path.slice(0, 300) : "/";
    const locale = body.locale === "en" ? "en" : "fr";
    const ref =
      typeof body.referrer === "string" && body.referrer
        ? referrerHost(body.referrer, new URL(APP_URL()).hostname)
        : null;

    const hash = visitorHash(clientIp(req), req.headers.get("user-agent") ?? "");
    const id = await recordView({ visitorHash: hash, path, locale, referrerHost: ref });
    return NextResponse.json({ id });
  } catch {
    // Silencieux à dessein : l'analytique ne doit jamais faire échouer une
    // page pour le visiteur qui la consulte.
    return NextResponse.json({ id: null });
  }
}
