import type { Metadata } from "next";
import { Home } from "@/components/pages/Home";
import { dict } from "@/lib/i18n";
import { alternates } from "@/lib/seo";

const LOCALE = "fr" as const;
export const revalidate = 300;

export const metadata: Metadata = {
  title: dict(LOCALE).home.metaTitle,
  description: dict(LOCALE).home.metaDescription,
  alternates: alternates("/", LOCALE),
};

export default function Page() {
  return <Home locale={LOCALE} />;
}
