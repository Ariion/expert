import { ImageResponse } from "next/og";
import { BRAND, toneColor } from "@/lib/brand";
import { dict, type Locale } from "@/lib/i18n";
import { statusLabel } from "@/lib/format";
import type { ServiceStatus } from "@/lib/feeds";

export const OG_SIZE = { width: 1200, height: 630 };

/**
 * Aperçus de partage.
 *
 * Un lien sans image passe en carte grise sur Slack, LinkedIn et X — c'est-à-dire
 * exactement là où la diffusion se joue. Ces images sont générées à la demande
 * plutôt que dessinées une fois : le nom de domaine n'y figure jamais, la marque
 * s'y lit seule, et la carte d'une page fournisseur affiche son état réel au
 * moment du partage.
 */
const MARK = (
  <svg width="40" height="40" viewBox="0 0 44 44" fill="none">
    <path
      d="M4 26 H13 L18 12 L25 33 L30 24 H40"
      stroke={BRAND.accentSoft}
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function frame(children: React.ReactNode) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        backgroundColor: BRAND.bg,
        backgroundImage: `radial-gradient(1100px 520px at 50% -180px, ${BRAND.bgGlow} 0%, ${BRAND.bg} 62%)`,
        color: BRAND.text,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {MARK}
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: "-0.01em" }}>
          Upstream Status
        </div>
      </div>
      {children}
    </div>
  );
}

/** Carte générique du site : accueil, tarifs, catégories. */
export function siteImage(locale: Locale) {
  const headline =
    locale === "en"
      ? "Your providers go down.\nYou hear it before your customers do."
      : "Vos fournisseurs tombent.\nVous l'apprenez avant vos clients.";
  const sub =
    locale === "en"
      ? "145 official status pages, read every 5 minutes. One alert to email, Slack or a webhook."
      : "145 status pages officielles, relevées toutes les 5 minutes. Une alerte par email, Slack ou webhook.";

  return new ImageResponse(
    frame(
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div
          style={{
            display: "flex",
            fontSize: 58,
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: "-0.025em",
            whiteSpace: "pre-wrap",
            maxWidth: 980,
          }}
        >
          {headline}
        </div>
        <div style={{ display: "flex", fontSize: 27, color: BRAND.muted, maxWidth: 900 }}>{sub}</div>
      </div>,
    ),
    OG_SIZE,
  );
}

/** Carte d'une page fournisseur : elle porte l'état réel au moment du partage. */
export function serviceImage(args: {
  locale: Locale;
  name: string;
  status: ServiceStatus;
  uptime: number | null;
  incidents: number;
}) {
  const { locale, name, status, uptime, incidents } = args;
  const t = dict(locale);
  const tone = toneColor(status);

  const stat = (label: string, value: string) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", fontSize: 20, color: BRAND.muted }}>{label}</div>
      <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>{value}</div>
    </div>
  );

  return new ImageResponse(
    frame(
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
          }}
        >
          {t.service.h1(name)}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", width: 20, height: 20, borderRadius: 20, backgroundColor: tone }} />
          <div style={{ display: "flex", fontSize: 38, fontWeight: 600, color: tone }}>
            {statusLabel(status, locale)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 64,
            paddingTop: 26,
            borderTop: `2px solid ${BRAND.line}`,
          }}
        >
          {stat(t.service.kpiUptime, uptime === null ? "—" : `${uptime.toFixed(2)} %`)}
          {stat(t.service.kpiIncidents, String(incidents))}
        </div>
      </div>,
    ),
    OG_SIZE,
  );
}
