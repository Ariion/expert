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
