import type { Metadata } from "next";
import "../globals.css";

/**
 * Racine dédiée à /admin : ce groupe n'est ni `(fr)` ni `(en)`, il lui faut
 * donc son propre `<html>`/`<body>`. Panneau interne à un seul opérateur —
 * pas de traduction, pas de navigation publique, jamais indexé.
 */
export const metadata: Metadata = {
  title: "Admin — Upstream Status",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ background: "var(--bg)" }}>{children}</body>
    </html>
  );
}
