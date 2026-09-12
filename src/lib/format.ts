import type { ServiceStatus } from "./feeds";

export const STATUS_LABEL: Record<ServiceStatus, string> = {
  operational: "Opérationnel",
  degraded: "Performances dégradées",
  partial_outage: "Panne partielle",
  major_outage: "Panne majeure",
  maintenance: "Maintenance",
  unknown: "Inconnu",
};

export const STATUS_TONE: Record<ServiceStatus, "ok" | "warn" | "bad" | "muted"> = {
  operational: "ok",
  degraded: "warn",
  partial_outage: "warn",
  major_outage: "bad",
  maintenance: "muted",
  unknown: "muted",
};

export const IMPACT_LABEL: Record<string, string> = {
  none: "Aucun",
  minor: "Mineur",
  major: "Majeur",
  critical: "Critique",
  maintenance: "Maintenance",
};

export function timeAgo(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.round(h / 24);
  if (days < 30) return `il y a ${days} j`;
  const months = Math.round(days / 30);
  return months < 12 ? `il y a ${months} mois` : `il y a ${Math.round(months / 12)} an(s)`;
}

export function fmtDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export function fmtDuration(from: Date | string, to: Date | string | null): string {
  const a = new Date(from).getTime();
  const b = to ? new Date(to).getTime() : Date.now();
  const min = Math.max(0, Math.round((b - a) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return h < 24 ? `${h} h ${rest ? `${rest} min` : ""}`.trim() : `${Math.floor(h / 24)} j ${h % 24} h`;
}

export function faviconFor(domain: string | null): string {
  return `https://www.google.com/s2/favicons?domain=${domain ?? "example.com"}&sz=64`;
}

