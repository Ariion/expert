import type { Metadata } from "next";
import { Legal } from "@/components/pages/Legal";
import { dict } from "@/lib/i18n";
import { alternates } from "@/lib/seo";

const LOCALE = "en" as const;

export const metadata: Metadata = {
  title: dict(LOCALE).legal.metaTitle,
  description: dict(LOCALE).legal.metaDescription,
  alternates: alternates("/legal", LOCALE),
  robots: { index: false, follow: true },
};

export default function Page() {
  return <Legal locale={LOCALE} />;
}
