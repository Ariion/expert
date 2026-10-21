import { compareImage, siteImage } from "@/components/og";
import { getServiceBySlug } from "@/lib/queries";
import { splitPair } from "@/components/pages/ComparePage";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Upstream Status";

export default async function Image({ params }: { params: Promise<{ pair: string }> }) {
  const { pair } = await params;
  const parts = splitPair(pair);
  if (!parts) return siteImage("en");

  const [a, b] = await Promise.all([
    getServiceBySlug(parts[0]).catch(() => null),
    getServiceBySlug(parts[1]).catch(() => null),
  ]);
  if (!a || !b) return siteImage("en");

  return compareImage({
    locale: "en",
    a: { name: a.name, status: a.current_status },
    b: { name: b.name, status: b.current_status },
  });
}
