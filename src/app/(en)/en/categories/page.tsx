import type { Metadata } from "next";
import { CategoriesIndex } from "@/components/pages/CategoriesIndex";
import { dict } from "@/lib/i18n";
import { alternates } from "@/lib/seo";

const LOCALE = "en" as const;
export const revalidate = 900;

export const metadata: Metadata = {
  title: dict(LOCALE).categories.metaTitle,
  description: dict(LOCALE).categories.metaDescription,
  alternates: alternates("/categories", LOCALE),
};

export default function Page() {
  return <CategoriesIndex locale={LOCALE} />;
}
