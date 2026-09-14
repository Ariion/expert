import type { ServiceStatus } from "./feeds";
import { DEFAULT_LOCALE, dict, type Locale } from "./i18n";

export const STATUS_TONE: Record<ServiceStatus, "ok" | "warn" | "bad" | "muted"> = {
  operational: "ok",
  degraded: "warn",
  partial_outage: "warn",
  major_outage: "bad",
  maintenance: "muted",
  unknown: "muted",
};

/**
 * Un service est-il réellement en panne ?
 *
 * « Inconnu » n'en est pas une : c'est l'état d'un fournisseur qu'on n'a pas
 * encore interrogé, ou dont le flux est momentanément illisible. Le compter
 * comme un incident ferait annoncer une panne générale au lendemain de chaque
 * installation — le genre de faux signal qui coûte la confiance d'un lecteur
 * en une seconde. « Maintenance » n'en est pas une non plus : elle est
 * annoncée, donc subie par personne.
 */
export function isDown(status: ServiceStatus): boolean {
  return status === "degraded" || status === "partial_outage" || status === "major_outage";
}

export function statusLabel(status: ServiceStatus, locale: Locale = DEFAULT_LOCALE): string {
  return dict(locale).status[status] ?? dict(locale).status.unknown;
}

export function impactLabel(impact: string, locale: Locale = DEFAULT_LOCALE): string {
  const table = dict(locale).impact as Record<string, string>;
  return table[impact] ?? impact;
}

/** Conservé pour les usages internes qui restent en français (emails, rapports). */
export const STATUS_LABEL: Record<ServiceStatus, string> = {
  operational: statusLabel("operational"),
  degraded: statusLabel("degraded"),
  partial_outage: statusLabel("partial_outage"),
  major_outage: statusLabel("major_outage"),
  maintenance: statusLabel("maintenance"),
  unknown: statusLabel("unknown"),
};

export function timeAgo(date: Date | string | null, locale: Locale = DEFAULT_LOCALE): string {
  const t = dict(locale).time;
  if (!date) return t.never;
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return t.justNow;
  if (min < 60) return t.minutes(min);
  const h = Math.round(min / 60);
  if (h < 24) return t.hours(h);
  const days = Math.round(h / 24);
  if (days < 30) return t.days(days);
  const months = Math.round(days / 30);
  return months < 12 ? t.months(months) : t.years(Math.round(months / 12));
}

/**
 * Horodatage en UTC, identique dans les deux langues : une date affichée dans
 * le fuseau du serveur induirait en erreur un lecteur situé ailleurs, et c'est
 * précisément le public que la version anglaise vise.
 */
export function fmtDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export function fmtDuration(
  from: Date | string,
  to: Date | string | null,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const a = new Date(from).getTime();
  const b = to ? new Date(to).getTime() : Date.now();
  const min = Math.max(0, Math.round((b - a) / 60000));
  const u = locale === "en" ? { m: "min", h: "h", d: "d" } : { m: "min", h: "h", d: "j" };
  if (min < 60) return `${min} ${u.m}`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  if (h < 24) return `${h} ${u.h} ${rest ? `${rest} ${u.m}` : ""}`.trim();
  return `${Math.floor(h / 24)} ${u.d} ${h % 24} ${u.h}`;
}

export function faviconFor(domain: string | null): string {
  return `https://www.google.com/s2/favicons?domain=${domain ?? "example.com"}&sz=64`;
}
