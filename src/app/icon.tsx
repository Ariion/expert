import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/**
 * Favicon généré plutôt que dessiné : une seule source de vérité pour les
 * couleurs de la marque, et rien à regénérer à la main le jour où elles
 * changent. Le motif est l'impulsion qui donne son nom au produit — un tracé
 * plat qui se casse, lisible même à 16 pixels.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND.bg,
          borderRadius: 14,
        }}
      >
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <path
            d="M4 26 H13 L18 12 L25 33 L30 24 H40"
            stroke={BRAND.accentSoft}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
