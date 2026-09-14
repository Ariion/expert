import type { Metadata } from "next";
import { Welcome } from "@/components/pages/Welcome";
import { dict } from "@/lib/i18n";

const LOCALE = "en" as const;

export const metadata: Metadata = {
  title: dict(LOCALE).welcome.metaTitle,
  description: dict(LOCALE).welcome.metaDescription,
  robots: { index: false, follow: false },
};

export default function Page() {
  return <Welcome locale={LOCALE} />;
}
