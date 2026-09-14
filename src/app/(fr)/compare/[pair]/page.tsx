import type { Metadata } from "next";
import { ComparePage, splitPair } from "@/components/pages/ComparePage";
import { getServiceBySlug } from "@/lib/queries";
import { dict } from "@/lib/i18n";
import { alternates } from "@/lib/seo";

const LOCALE = "fr" as const;
export const revalidate = 900;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pair: string }>;
}): Promise<Metadata> {
  const { pair } = await params;
  const t = dict(LOCALE);
  const parts = splitPair(pair);
  if (!parts) return { title: t.compare.notFound };

  const [a, b] = await Promise.all([
    getServiceBySlug(parts[0]).catch(() => null),
    getServiceBySlug(parts[1]).catch(() => null),
  ]);
  if (!a || !b) return { title: t.compare.notFound };

  return {
    title: t.compare.metaTitle(a.name, b.name),
    description: t.compare.metaDescription(a.name, b.name),
    alternates: alternates(`/compare/${pair}`, LOCALE),
  };
}

export default async function Page({ params }: { params: Promise<{ pair: string }> }) {
  const { pair } = await params;
  return <ComparePage locale={LOCALE} pair={pair} />;
}
