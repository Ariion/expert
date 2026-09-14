import type { Metadata } from "next";
import { Login } from "@/components/pages/Login";
import { dict } from "@/lib/i18n";

const LOCALE = "en" as const;

export const metadata: Metadata = {
  title: dict(LOCALE).login.metaTitle,
  description: dict(LOCALE).login.metaDescription,
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; next?: string }>;
}) {
  const sp = await searchParams;
  return <Login locale={LOCALE} sent={sp.sent} error={sp.error} next={sp.next} />;
}
