import type { Metadata } from "next";
import { APP_URL, SITE_NAME } from "@/lib/env";
import { SiteChrome } from "@/components/SiteChrome";
import { dict, HTML_LANG, OG_LOCALE } from "@/lib/i18n";
import { googleVerification } from "@/lib/seo";
import { mono, sans } from "@/lib/fonts";
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

// Données structurées site-level : lues une fois par les moteurs/agents, pas
// par les visiteurs. Uniquement des faits déjà vrais ailleurs sur le site
// (nom, URL, icône, description) — jamais de note, d'avis ou de compteur
// inventé pour paraître plus établi.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: SITE_NAME,
      url: APP_URL(),
      logo: `${APP_URL()}/icon`,
    },
    {
      "@type": "WebSite",
      name: SITE_NAME,
      url: APP_URL(),
      description: t.home.metaDescription,
      inLanguage: HTML_LANG[LOCALE],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={HTML_LANG[LOCALE]} className={`${sans.variable} ${mono.variable}`}>
      <body>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <SiteChrome locale={LOCALE}>{children}</SiteChrome>
      </body>
    </html>
  );
}
