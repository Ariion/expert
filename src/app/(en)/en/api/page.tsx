import type { Metadata } from "next";
import { ApiDocs } from "@/components/pages/ApiDocs";
import { dict } from "@/lib/i18n";
import { alternates } from "@/lib/seo";

const LOCALE = "en" as const;
export const revalidate = 86400;

export const metadata: Metadata = {
  title: dict(LOCALE).apiPage.metaTitle,
  description: dict(LOCALE).apiPage.metaDescription,
  alternates: alternates("/api", LOCALE),
};

export default function Page() {
  return <ApiDocs locale={LOCALE} />;
}
