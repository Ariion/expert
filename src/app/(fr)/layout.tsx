import type { Metadata } from "next";
import { APP_URL, SITE_NAME } from "@/lib/env";
import { SiteChrome } from "@/components/SiteChrome";
import { dict, HTML_LANG, OG_LOCALE } from "@/lib/i18n";
import { googleVerification } from "@/lib/seo";
import "../globals.css";

const LOCALE = "fr" as const;
const t = dict(LOCALE);

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL()),
  title: { default: `${SITE_NAME} — ${t.home.metaTitle}`, template: `%s | ${SITE_NAME}` },
  description: t.home.metaDescription,
  openGraph: { type: "website", siteName: SITE_NAME, locale: OG_LOCALE[LOCALE] },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  verification: { google: googleVerification() },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={HTML_LANG[LOCALE]}>
      <body>
        <SiteChrome locale={LOCALE}>{children}</SiteChrome>
      </body>
    </html>
  );
}
