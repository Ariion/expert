import type { Metadata } from "next";
import { Dashboard } from "@/components/pages/Dashboard";
import { dict } from "@/lib/i18n";

const LOCALE = "en" as const;
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: dict(LOCALE).dashboard.metaTitle,
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string; error?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  return <Dashboard locale={LOCALE} upgraded={sp.upgraded} ok={sp.ok} error={sp.error} />;
}
