import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";
import { APP_URL } from "./env";

export type ServiceStatus =
  | "operational"
  | "degraded"
  | "partial_outage"
  | "major_outage"
  | "maintenance"
  | "unknown";

export type Impact = "none" | "minor" | "major" | "critical" | "maintenance";
export type IncidentState =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved"
  | "scheduled"
  | "completed";

export interface RawIncident {
  externalId: string;
  title: string;
  body: string | null;
  url: string | null;
  impact: Impact;
  state: IncidentState;
  startedAt: Date;
  resolvedAt: Date | null;
}

export interface FeedResult {
  notModified: boolean;
  etag: string | null;
  lastModified: string | null;
  status: ServiceStatus;
  incidents: RawIncident[];
}

/**
 * Identité annoncée aux fournisseurs qu'on interroge.
 *
 * L'adresse suit `APP_URL` plutôt que d'être écrite en dur : un fournisseur
 * qui veut savoir qui le sollicite doit tomber sur le site en service, pas sur
 * une ancienne adresse abandonnée après un changement de domaine. Évaluée à
 * chaque appel, jamais au chargement du module : pendant le build, APP_URL
 * vaut encore son repli local.
 */
const userAgent = () =>
  `UpstreamStatusBot/1.0 (+${APP_URL()}; vendor status aggregation)`;

const INDICATOR_TO_STATUS: Record<string, ServiceStatus> = {
  none: "operational",
  minor: "degraded",
  major: "partial_outage",
  critical: "major_outage",
  maintenance: "maintenance",
};

export function hashIncident(i: RawIncident): string {
  return createHash("sha1")
    .update(
      [i.externalId, i.title, i.state, i.impact, i.body ?? "", i.resolvedAt?.toISOString() ?? ""].join(
        "|",
      ),
    )
    .digest("hex");
}

/** Fetch avec timeout dur + en-têtes conditionnels (economie de bande passante). */
async function httpGet(
  url: string,
  conditional: { etag?: string | null; lastModified?: string | null },
): Promise<{ status: number; body: string; etag: string | null; lastModified: string | null }> {
  const headers: Record<string, string> = {
    "user-agent": userAgent(),
    accept: "application/json, application/atom+xml, application/rss+xml, text/xml;q=0.9, */*;q=0.5",
  };
  if (conditional.etag) headers["if-none-match"] = conditional.etag;
  if (conditional.lastModified) headers["if-modified-since"] = conditional.lastModified;

  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(12000),
    redirect: "follow",
    cache: "no-store",
  });

  return {
    status: res.status,
    body: res.status === 304 ? "" : await res.text(),
    etag: res.headers.get("etag"),
    lastModified: res.headers.get("last-modified"),
  };
}

function toDate(value: unknown, fallback?: Date): Date {
  const d = value ? new Date(String(value)) : null;
  return d && !Number.isNaN(d.getTime()) ? d : (fallback ?? new Date());
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Statuspage.io — /api/v2/summary.json (format le plus répandu du marché)
// ---------------------------------------------------------------------------
interface StatuspageSummary {
  status?: { indicator?: string; description?: string };
  incidents?: Array<{
    id: string;
    name: string;
    status: string;
    impact: string;
    shortlink?: string;
    created_at: string;
    started_at?: string;
    resolved_at?: string | null;
    incident_updates?: Array<{ body?: string; created_at?: string }>;
  }>;
  scheduled_maintenances?: Array<{
    id: string;
    name: string;
    status: string;
    shortlink?: string;
    scheduled_for?: string;
    created_at: string;
    scheduled_until?: string | null;
    incident_updates?: Array<{ body?: string }>;
  }>;
}

function parseStatuspage(body: string): { status: ServiceStatus; incidents: RawIncident[] } {
  const data = JSON.parse(body) as StatuspageSummary;
  const status = INDICATOR_TO_STATUS[data.status?.indicator ?? ""] ?? "unknown";

  const incidents: RawIncident[] = (data.incidents ?? []).map((inc) => {
    const resolved = inc.status === "resolved" || inc.status === "postmortem";
    return {
      externalId: inc.id,
      title: inc.name,
      body: inc.incident_updates?.[0]?.body?.slice(0, 4000) ?? null,
      url: inc.shortlink ?? null,
      impact: (["none", "minor", "major", "critical"].includes(inc.impact)
        ? inc.impact
        : "minor") as Impact,
      state: (
        ["investigating", "identified", "monitoring", "resolved"].includes(inc.status)
          ? inc.status
          : resolved
            ? "resolved"
            : "investigating"
      ) as IncidentState,
      startedAt: toDate(inc.started_at ?? inc.created_at),
      resolvedAt: resolved ? toDate(inc.resolved_at, new Date()) : null,
    };
  });

  for (const m of data.scheduled_maintenances ?? []) {
    const done = m.status === "completed";
    incidents.push({
      externalId: m.id,
      title: m.name,
      body: m.incident_updates?.[0]?.body?.slice(0, 4000) ?? null,
      url: m.shortlink ?? null,
      impact: "maintenance",
      state: done ? "completed" : "scheduled",
      startedAt: toDate(m.scheduled_for ?? m.created_at),
      resolvedAt: done ? toDate(m.scheduled_until, new Date()) : null,
    });
  }

  return { status, incidents };
}

// ---------------------------------------------------------------------------
// Atom / RSS — repli universel pour les fournisseurs hors Statuspage
// ---------------------------------------------------------------------------
const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  // Les entités ne sont pas développées : certains flux en contiennent assez
  // pour déclencher la protection anti-expansion du parseur et faire échouer
  // la lecture (« Entity expansion limit exceeded »). Les quelques entités
  // utiles sont traduites au nettoyage du HTML.
  processEntities: false,
});

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Un flux Atom/RSS n'expose pas d'état : chaque entrée est un billet daté, pas
 * un incident vivant. Tout l'enjeu est de ne pas prendre un journal
 * d'événements passés pour une panne en cours.
 *
 * Le cas d'école est AWS : son flux publie chaque événement de chaque service
 * dans chaque région, y compris purement informatif, et la plupart sont clos
 * depuis longtemps. Lus naïvement, ils faisaient afficher « panne majeure » à
 * un fournisseur parfaitement opérationnel — une page qui ment sur ce qu'elle
 * est censée établir ne vaut rien.
 */
const RESOLVED_MARK =
  /^\s*\[?\s*(resolved|closed|completed)\s*\]?\b|\b(resolved|completed|restored|closed|operating normally|back to normal|fully recovered|service restored)\b/i;

/** Au-delà de ce délai, une entrée non close est un événement passé. */
const STALE_AFTER_MS = 3 * 24 * 3600_000;

export function isResolvedEntry(title: string, content: string, published: Date): boolean {
  if (RESOLVED_MARK.test(title) || RESOLVED_MARK.test(content)) return true;
  // Aucune panne réelle ne reste ouverte trois jours sans la moindre mise à
  // jour : passé ce délai, l'entrée décrit un événement terminé que le
  // fournisseur n'a simplement pas marqué comme tel.
  return Date.now() - published.getTime() > STALE_AFTER_MS;
}

export function guessImpact(text: string): Impact {
  const t = text.toLowerCase();
  if (/(maintenance|scheduled)/.test(t)) return "maintenance";
  // Classification explicite du fournisseur, quand il en donne une. AWS place
  // « Informational message » devant ce qui n'affecte pas le service : le
  // prendre pour une panne était l'erreur la plus coûteuse.
  if (/informational message|informational:/.test(t)) return "minor";
  if (/(major outage|complete outage|total outage|widespread|service is unavailable)/.test(t))
    return "critical";
  if (/(partial outage|service disruption|service degradation|degraded performance|elevated error)/.test(t))
    return "major";
  return "minor";
}

function parseXmlFeed(body: string): { status: ServiceStatus; incidents: RawIncident[] } {
  const doc = xml.parse(body) as Record<string, any>;
  const entries = doc?.feed ? asArray(doc.feed.entry) : asArray(doc?.rss?.channel?.item);

  const incidents: RawIncident[] = entries.slice(0, 50).map((e: any, idx: number) => {
    const title = String(e?.title?.["#text"] ?? e?.title ?? "Incident").trim();
    const rawContent = String(
      e?.content?.["#text"] ?? e?.content ?? e?.description ?? e?.summary ?? "",
    );
    const content = stripHtml(rawContent);
    const link =
      (typeof e?.link === "object" ? e.link?.["@_href"] : e?.link) ??
      asArray(e?.link)[0]?.["@_href"] ??
      null;
    const published = toDate(e?.published ?? e?.pubDate ?? e?.updated);
    const resolved = isResolvedEntry(title, content, published);

    return {
      externalId: String(e?.id ?? e?.guid?.["#text"] ?? e?.guid ?? link ?? `${published.getTime()}-${idx}`),
      title: title.slice(0, 300),
      body: content ? content.slice(0, 4000) : null,
      url: link ? String(link) : null,
      impact: guessImpact(`${title} ${content}`),
      state: resolved ? "resolved" : "monitoring",
      startedAt: published,
      resolvedAt: resolved ? toDate(e?.updated, published) : null,
    };
  });

  // Sans indicateur global, on déduit l'état des seules entrées encore
  // ouvertes ET récentes. Une entrée mineure ne suffit pas : sur un flux qui
  // publie chaque message informatif, elle maintiendrait le service en
  // « dégradé » en permanence.
  const sixHoursAgo = Date.now() - 6 * 3600_000;
  const open = incidents.filter(
    (i) => !i.resolvedAt && i.startedAt.getTime() > sixHoursAgo && i.impact !== "maintenance",
  );
  const status: ServiceStatus = open.some((i) => i.impact === "critical")
    ? "major_outage"
    : open.some((i) => i.impact === "major")
      ? "partial_outage"
      : "operational";

  return { status, incidents };
}

/**
 * Récupère et normalise le flux d'un fournisseur.
 * Toute erreur remonte : c'est l'appelant (ingest) qui décide du backoff.
 */
export async function fetchFeed(service: {
  feed_url: string;
  feed_kind: string;
  http_etag: string | null;
  http_last_modified: string | null;
}): Promise<FeedResult> {
  const res = await httpGet(service.feed_url, {
    etag: service.http_etag,
    lastModified: service.http_last_modified,
  });

  if (res.status === 304) {
    return { notModified: true, etag: service.http_etag, lastModified: service.http_last_modified, status: "unknown", incidents: [] };
  }
  if (res.status >= 400) {
    throw new Error(`HTTP ${res.status} sur ${service.feed_url}`);
  }

  const parsed =
    service.feed_kind === "statuspage_v2" ? parseStatuspage(res.body) : parseXmlFeed(res.body);

  return {
    notModified: false,
    etag: res.etag,
    lastModified: res.lastModified,
    status: parsed.status,
    // Garde-fou : on ignore les entrées trop anciennes (bruit d'archives).
    incidents: parsed.incidents.filter(
      (i) => i.startedAt.getTime() > Date.now() - 400 * 24 * 3600_000,
    ),
  };
}
