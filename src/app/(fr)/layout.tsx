import type { Metadata } from "next";
import { APP_URL, SITE_NAME, envOr } from "@/lib/env";
import { SiteChrome } from "@/components/SiteChrome";
import { dict, HTML_LANG, OG_LOCALE } from "@/lib/i18n";
import "../globals.css";

const LOCALE = "fr" as const;
const t = dict(LOCALE);

// Pas un secret : cette valeur est de toute façon visible dans le code source
// de chaque page. En dur pour éviter une variable Vercel de plus ; une
// variable d'environnement du même nom la remplace si besoin de revérifier.
const googleVerification = envOr(
  "GOOGLE_SITE_VERIFICATION",
  "UQz3B2Rz2749O39UP8ew7f8NkLYZ0h7Don-xU4iMozA",
);

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL()),
  title: { default: `${SITE_NAME} — ${t.home.metaTitle}`, template: `%s | ${SITE_NAME}` },
  description: t.home.metaDescription,
  openGraph: { type: "website", siteName: SITE_NAME, locale: OG_LOCALE[LOCALE] },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  verification: { google: googleVerification },
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
