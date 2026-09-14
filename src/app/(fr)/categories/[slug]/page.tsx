import type { Metadata } from "next";
import { CategoryPage } from "@/components/pages/CategoryPage";
import { getServicesByCategory } from "@/lib/queries";
import { categoryLabel, dict } from "@/lib/i18n";
import { alternates } from "@/lib/seo";

const LOCALE = "fr" as const;
export const revalidate = 600;
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
  const label = categoryLabel(slug, LOCALE);
  const services = await getServicesByCategory(slug).catch(() => []);
  return {
    title: t.category.metaTitle(label, services.length),
    description: t.category.metaDescription(
      label,
      services.slice(0, 8).map((s) => s.name).join(", "),
    ),
    alternates: alternates(`/categories/${slug}`, LOCALE),
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CategoryPage locale={LOCALE} slug={slug} />;
}
