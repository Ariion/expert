import type { Metadata } from "next";
import { StatusIndex } from "@/components/pages/StatusIndex";
import { dict } from "@/lib/i18n";
import { alternates } from "@/lib/seo";

const LOCALE = "en" as const;
export const revalidate = 300;

export const metadata: Metadata = {
  title: dict(LOCALE).statusIndex.metaTitle,
  description: dict(LOCALE).statusIndex.metaDescription,
  alternates: alternates("/status", LOCALE),
};

export default function Page() {
  return <StatusIndex locale={LOCALE} />;
}
