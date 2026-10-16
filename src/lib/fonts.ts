import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";

/**
 * Deux familles, un seul rôle chacune.
 *
 * Instrument Sans porte tout le texte — titres et corps — à la place de la
 * police système, qui ne portait aucune identité. IBM Plex Mono est réservée
 * à ce qui est une mesure plutôt qu'une phrase : pourcentages, durées,
 * horodatages, exemples de requêtes API. Les deux sont auto-hébergées au
 * build par `next/font` : aucune requête tierce ajoutée côté client, donc
 * aucun coût pour les pages SEO qui doivent rester du HTML pur.
 */
export const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});
