import { ImageResponse } from "next/og";
import { BRAND, Mark } from "@/lib/brand";

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
        <Mark size={44} />
      </div>
    ),
    size,
  );
}
