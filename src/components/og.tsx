import { ImageResponse } from "next/og";
import { BRAND, Mark, toneColor } from "@/lib/brand";
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
        <Mark size={40} />
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

/** Carte d'une catégorie : combien de services, combien en incident au moment du partage. */
export function categoryImage(args: { locale: Locale; label: string; total: number; down: number }) {
  const { locale, label, total, down } = args;
  const t = dict(locale);
  const tone = down > 0 ? toneColor("major_outage") : toneColor("operational");

  return new ImageResponse(
    frame(
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        <div
          style={{
            display: "flex",
            fontSize: 60,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
            maxWidth: 1000,
          }}
        >
          {t.category.h1(label)}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", width: 20, height: 20, borderRadius: 20, backgroundColor: tone }} />
          <div style={{ display: "flex", fontSize: 34, fontWeight: 600, color: tone }}>
            {t.category.lead(total, down)}
          </div>
        </div>
      </div>,
    ),
    OG_SIZE,
  );
}

/** Carte d'un comparatif : les deux fournisseurs, statut réel côte à côte. */
export function compareImage(args: {
  locale: Locale;
  a: { name: string; status: ServiceStatus };
  b: { name: string; status: ServiceStatus };
}) {
  const { locale, a, b } = args;

  const side = (s: { name: string; status: ServiceStatus }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
      <div style={{ display: "flex", fontSize: 42, fontWeight: 700, letterSpacing: "-0.02em" }}>
        {s.name}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            display: "flex",
            width: 16,
            height: 16,
            borderRadius: 16,
            backgroundColor: toneColor(s.status),
          }}
        />
        <div style={{ display: "flex", fontSize: 26, fontWeight: 600, color: toneColor(s.status) }}>
          {statusLabel(s.status, locale)}
        </div>
      </div>
    </div>
  );

  return new ImageResponse(
    frame(
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        <div style={{ display: "flex", fontSize: 30, color: BRAND.muted }}>
          {locale === "en" ? "Reliability compared" : "Fiabilité comparée"}
        </div>
        <div style={{ display: "flex", gap: 56, paddingTop: 10, borderTop: `2px solid ${BRAND.line}` }}>
          {side(a)}
          {side(b)}
        </div>
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
