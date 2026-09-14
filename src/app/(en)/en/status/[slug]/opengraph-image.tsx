import { OG_SIZE, serviceImage, siteImage } from "@/components/og";
import { getServiceBySlug } from "@/lib/queries";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "StatusPulse";

/**
 * Générée à la demande : une carte partagée pendant une panne doit montrer
 * l'état de la panne, pas celui d'hier. Si le fournisseur est introuvable on
 * retombe sur la carte générique — jamais d'image cassée dans un fil de
 * discussion.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = await getServiceBySlug(slug).catch(() => null);
  if (!service) return siteImage("en");

  return serviceImage({
    locale: "en",
    name: service.name,
    status: service.current_status,
    uptime: service.uptime_90d === null ? null : Number(service.uptime_90d),
    incidents: service.incident_count_90d,
  });
}
