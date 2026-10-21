import { categoryImage, siteImage } from "@/components/og";
import { getServicesByCategory } from "@/lib/queries";
import { isDown } from "@/lib/format";
import { categoryLabel } from "@/lib/i18n";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Upstream Status";

/**
 * Same logic as the provider page: the shared card must show the category's
 * real state at share time, never a frozen image.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const services = await getServicesByCategory(slug).catch(() => []);
  if (services.length === 0) return siteImage("en");

  return categoryImage({
    locale: "en",
    label: categoryLabel(slug, "en"),
    total: services.length,
    down: services.filter((s) => isDown(s.current_status)).length,
  });
}
