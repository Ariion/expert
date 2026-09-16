/**
 * Sérialisation CSV.
 *
 * Écrite plutôt qu'empruntée : les titres d'incidents contiennent virgules,
 * guillemets et retours à la ligne — « Elevated errors in EU-West, "read
 * replica" » suffit à décaler toutes les colonnes d'un tableur si l'échappement
 * est approximatif. Un export silencieusement corrompu est pire que pas
 * d'export : il est découvert au moment d'un post-mortem, quand on compte
 * dessus.
 *
 * Convention retenue : RFC 4180 — guillemets doublés, champ entouré dès qu'il
 * contient un séparateur, un guillemet ou un saut de ligne.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = value instanceof Date ? value.toISOString() : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  // BOM UTF-8 : sans lui, Excel sous Windows affiche « Ã© » à la place de « é »
  // et le fichier paraît cassé alors qu'il est correct.
  return `﻿${lines.join("\r\n")}\r\n`;
}
