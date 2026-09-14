import type { Metadata } from "next";
import { Pricing } from "@/components/pages/Pricing";
import { dict } from "@/lib/i18n";
import { alternates } from "@/lib/seo";

const LOCALE = "fr" as const;

export const metadata: Metadata = {
  title: dict(LOCALE).pricing.metaTitle,
  description: dict(LOCALE).pricing.metaDescription,
  alternates: alternates("/pricing", LOCALE),
};

export default function Page() {
  return <Pricing locale={LOCALE} />;
}
