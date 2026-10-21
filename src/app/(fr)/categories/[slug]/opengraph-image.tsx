import { categoryImage, siteImage } from "@/components/og";
import { getServicesByCategory } from "@/lib/queries";
import { isDown } from "@/lib/format";
import { categoryLabel } from "@/lib/i18n";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Upstream Status";

/**
 * Même logique que la fiche fournisseur : la carte partagée doit montrer
 * l'état réel de la catégorie au moment du partage, jamais une image figée.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const services = await getServicesByCategory(slug).catch(() => []);
  if (services.length === 0) return siteImage("fr");

  return categoryImage({
    locale: "fr",
    label: categoryLabel(slug, "fr"),
    total: services.length,
    down: services.filter((s) => isDown(s.current_status)).length,
  });
}
