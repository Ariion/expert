import type { Metadata } from "next";
import { ServicePage } from "@/components/pages/ServicePage";
import { getServiceBySlug } from "@/lib/queries";
import { statusLabel } from "@/lib/format";
import { dict } from "@/lib/i18n";
import { absolute, alternates } from "@/lib/seo";

const LOCALE = "en" as const;

/**
 * Revalidation à 2 minutes : c'est la fraîcheur qui fait la valeur d'une page
 * « est-ce en panne ». Aucune page n'est pré-rendue au build — les générer
 * toutes exigeait autant d'allers-retours vers la base pendant la compilation,
 * un déploiement en est mort, pour un résultat que la revalidation remplace
 * quelques minutes plus tard de toute façon.
 */
export const revalidate = 120;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = dict(LOCALE);
  const service = await getServiceBySlug(slug).catch(() => null);
  if (!service) return { title: t.service.notFound };

  const status = statusLabel(service.current_status, LOCALE);
  const description = t.service.metaDescription(service.name, status);

  return {
    title: t.service.metaTitle(service.name),
    description,
    alternates: alternates(`/status/${service.slug}`, LOCALE),
    openGraph: {
      title: `${service.name} : ${status}`,
      description,
      url: absolute(`/status/${service.slug}`, LOCALE),
      type: "website",
    },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ServicePage locale={LOCALE} slug={slug} />;
}
