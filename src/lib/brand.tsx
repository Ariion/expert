/**
 * Constantes de marque partagées par les images générées (favicon, aperçus de
 * partage). Reprises à l'identique de `globals.css` : une carte de partage qui
 * ne ressemble pas au site qu'elle annonce sème le doute au moment précis où
 * quelqu'un décide de cliquer.
 */
export const BRAND = {
  bg: "#080b16",
  bgGlow: "#1b2444",
  card: "#131a2f",
  line: "#232c49",
  text: "#eef1f8",
  muted: "#97a1bd",
  accent: "#6366f1",
  accentSoft: "#818cf8",
  // Accent secondaire — réservé au motif de la marque et à quelques détails
  // de graphique, jamais aux couleurs de statut ci-dessous. Volontairement
  // différent du vert : chez nous, vert veut déjà dire « opérationnel ».
  // Toute valeur changée ici doit être recopiée dans les variables CSS de
  // `globals.css` (`--accent-2`) au même commit — `next/og` ne lit pas les
  // variables CSS, ces deux fichiers sont la seule source de vérité qu'il
  // puisse consommer.
  accent2: "#5eead4",
  accent2Soft: "#99f6e4",
  ok: "#22c55e",
  warn: "#f59e0b",
  bad: "#ef4444",
} as const;

/** Couleur associée à un état de service, pour les images générées. */
export function toneColor(status: string): string {
  if (status === "operational") return BRAND.ok;
  if (status === "major_outage") return BRAND.bad;
  if (status === "degraded" || status === "partial_outage") return BRAND.warn;
  return BRAND.muted;
}

/**
 * Le tracé de marque — une ligne d'impulsion plate-pic-plat, lisible jusqu'à
 * 16 pixels. Source unique : `icon.tsx` (favicon) et `og.tsx` (aperçus de
 * partage) l'important plutôt que de le redupliquer, pour n'avoir qu'un
 * endroit à corriger le jour où le tracé change.
 */
export const MARK_PATH = "M4 26 H13 L18 12 L25 33 L30 24 H40";

export function Mark({ size = 44, stroke = BRAND.accentSoft }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <path d={MARK_PATH} stroke={stroke} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
