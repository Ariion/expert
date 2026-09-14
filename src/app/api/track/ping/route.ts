import { NextResponse } from "next/server";
import { pingView } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Signal de présence, envoyé tant que l'onglet reste ouvert et visible.
 * `navigator.sendBeacon` poste en `text/plain` : le corps est lu tel quel.
 */
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const id = (JSON.parse(raw || "{}") as { id?: string }).id ?? "";
    if (id) await pingView(id);
  } catch {
    // Idem : jamais bloquant.
  }
  return new NextResponse(null, { status: 204 });
}
