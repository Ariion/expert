import type { Metadata } from "next";
import Link from "next/link";
import { APP_URL, SITE_NAME } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL()),
  title: {
    default: `${SITE_NAME} — Surveillance et alertes sur vos fournisseurs SaaS`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Surveillez les status pages de tous vos fournisseurs (AWS, Stripe, Slack, GitHub…) au même endroit. Alerte email, Slack ou webhook dès la publication d'un incident.",
  openGraph: { type: "website", siteName: SITE_NAME, locale: "fr_FR" },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <nav className="nav">
          <div className="wrap nav-inner">
            <Link href="/" className="brand">
              Status<span>Pulse</span>
            </Link>
            <Link href="/status" className="link">
              Fournisseurs
            </Link>
            <Link href="/categories" className="link">
              Catégories
            </Link>
            <Link href="/pricing" className="link">
              Tarifs
            </Link>
            <div className="spacer" />
            <Link href="/dashboard" className="link">
              Connexion
            </Link>
            <Link href="/pricing" className="btn sm">
              Commencer
            </Link>
          </div>
        </nav>

        <main>{children}</main>

        <footer>
          <div className="wrap between">
            <div>
              <strong style={{ color: "var(--muted)" }}>{SITE_NAME}</strong> — agrégateur de status
              pages et alerting fournisseurs.
              <br />
              Données issues des pages de statut publiques officielles. Non affilié aux
              fournisseurs cités.
            </div>
            <div className="row">
              <Link href="/status">Tous les fournisseurs</Link>
              <Link href="/categories">Catégories</Link>
              <Link href="/pricing">Tarifs</Link>
              <Link href="/legal">Mentions légales</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
