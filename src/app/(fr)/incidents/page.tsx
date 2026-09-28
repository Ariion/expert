import type { Metadata } from "next";
import { IncidentsIndex } from "@/components/pages/IncidentsIndex";
import { dict } from "@/lib/i18n";
import { alternates } from "@/lib/seo";

const LOCALE = "fr" as const;
export const revalidate = 300;

export const metadata: Metadata = {
  title: dict(LOCALE).incidentsPage.metaTitle,
  description: dict(LOCALE).incidentsPage.metaDescription,
  alternates: alternates("/incidents", LOCALE),
};

export default function Page() {
  return <IncidentsIndex locale={LOCALE} />;
}
