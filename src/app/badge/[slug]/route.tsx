import { ImageResponse } from "next/og";
import { BRAND, Mark, toneColor } from "@/lib/brand";
import { SITE_NAME } from "@/lib/env";
import { statusLabel } from "@/lib/format";
import { asLocale } from "@/lib/i18n";
import { getServiceBySlug } from "@/lib/queries";

export const runtime = "nodejs";
export const revalidate = 120;

const SIZE = { width: 280, height: 64 };

/**
 * Badge de statut intégrable sur un site tiers.
 *
 * Donnée réelle (le statut déjà en base), et chaque intégration est un lien
 * retour naturel vers la fiche fournisseur — pas qu'un gadget visuel.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const locale = asLocale(searchParams.get("locale"));

  const service = await getServiceBySlug(slug).catch(() => null);
  if (!service) return new Response("Not found", { status: 404 });

  const tone = toneColor(service.current_status);
  const label = statusLabel(service.current_status, locale);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 16px",
          background: BRAND.card,
          border: `1px solid ${BRAND.line}`,
          borderRadius: 10,
          fontFamily: "sans-serif",
        }}
      >
        <Mark size={22} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 13, fontWeight: 700, color: BRAND.text }}>
            {service.name}
          </div>
          <div style={{ display: "flex", fontSize: 10, color: BRAND.muted }}>{SITE_NAME}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", width: 8, height: 8, borderRadius: 8, backgroundColor: tone }} />
          <div style={{ display: "flex", fontSize: 12, fontWeight: 600, color: tone }}>{label}</div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      headers: { "cache-control": "public, max-age=120, stale-while-revalidate=300" },
    },
  );
}
