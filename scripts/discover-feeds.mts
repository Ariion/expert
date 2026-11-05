/**
 * Découverte de flux — version stricte.
 *
 * Un flux valide n'est ni une page HTML, ni une page d'erreur. La première
 * version de ce script acceptait tout corps commençant par « < », ce qui
 * laissait passer les pages de statut elles-mêmes : on aurait inscrit une page
 * HTML à la place d'un flux, et l'ingestion aurait échoué plus loin, en
 * silence.
 *
 * On exige donc : réponse 200, corps qui n'est pas du HTML, et contenu
 * réellement parsable (objet JSON, ou XML avec une racine connue).
 */
import { SEED_SERVICES } from "../src/data/services";

const TIMEOUT_MS = 12_000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const BROKEN = [
  "bitwarden", "cal-com", "checkout-com", "crisp", "dashlane", "drift", "ea",
  "fastly", "freshworks", "gitlab", "hetzner", "league-of-legends", "minecraft",
  "onelogin", "pinterest", "pipedrive", "qonto", "revolut-business", "ringcentral",
  "sonarcloud", "spotify", "square", "storyblok", "typesense", "uptimerobot",
  "valorant", "vonage", "vultr", "x-twitter", "zendesk",
];

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
      headers: { "user-agent": UA, accept: "text/html,application/json,application/xml,text/xml,*/*" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

type Verdict = { ok: boolean; kind?: "json" | "xml"; code?: number; why?: string };

/** Vérifie qu'une adresse renvoie vraiment un flux exploitable. */
async function verify(url: string): Promise<Verdict> {
  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
      headers: { "user-agent": UA, accept: "application/json, application/xml, text/xml, */*" },
    });
  } catch (err) {
    return { ok: false, why: err instanceof Error ? err.name : "fetch" };
  }

  const body = await res.text();
  if (!res.ok) return { ok: false, code: res.status, why: `http ${res.status}` };
  if (body.length < 200) return { ok: false, code: res.status, why: "corps trop court" };

  const trimmed = body.trimStart();
  // Le piège de la première version : une page HTML commence aussi par « < ».
  if (/^<(!doctype\s+html|html\b)/i.test(trimmed)) {
    return { ok: false, code: res.status, why: "page html" };
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed !== "object" || parsed === null) {
        return { ok: false, code: res.status, why: "json non objet" };
      }
      // Un flux de statut porte toujours l'un de ces champs.
      const keys = Object.keys(parsed as Record<string, unknown>);
      const plausible = ["status", "components", "incidents", "data", "summary", "results"].some((k) =>
        keys.includes(k),
      );
      if (!plausible) return { ok: false, code: res.status, why: `json inattendu (${keys.slice(0, 4).join(",")})` };
      return { ok: true, kind: "json", code: res.status };
    } catch {
      return { ok: false, code: res.status, why: "json invalide" };
    }
  }

  if (trimmed.startsWith("<?xml") || /<(rss|feed|rdf:RDF)\b/i.test(trimmed.slice(0, 400))) {
    return { ok: true, kind: "xml", code: res.status };
  }

  return { ok: false, code: res.status, why: "ni json ni xml" };
}

function originOf(u: string): string | null {
  try {
    return new URL(u).origin;
  } catch {
    return null;
  }
}

async function discover(slug: string): Promise<void> {
  const s = SEED_SERVICES.find((x) => x.slug === slug);
  if (!s) {
    console.log(`??   ${slug} : absent du catalogue`);
    return;
  }

  const origin = originOf(s.status_page_url) ?? "";
  let host = "";
  try {
    host = new URL(s.status_page_url).hostname;
  } catch {
    host = "";
  }
  const bare = host.replace(/^(status|www|help|support|kb)\./, "");
  const base = bare.split(".")[0] ?? "";

  const html = await fetchText(s.status_page_url);
  const hints: string[] = [];

  if (html) {
    for (const m of html.matchAll(/https?:\/\/([a-z0-9-]+)\.(statuspage\.io|instatus\.com|status\.io|freshstatus\.io|betterstack\.com)/gi)) {
      const o = `https://${m[1]}.${m[2]}`;
      hints.push(o, `${o}/api/v2/summary.json`);
    }
    for (const m of html.matchAll(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*href=["']([^"']+)["']/gi)) {
      try { hints.push(new URL(m[1], s.status_page_url).toString()); } catch { /* ignore */ }
    }
    for (const m of html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*type=["']application\/(?:rss|atom)\+xml["']/gi)) {
      try { hints.push(new URL(m[1], s.status_page_url).toString()); } catch { /* ignore */ }
    }
  }

  const candidates = [
    ...hints,
    ...(s.alt_feeds ?? []),
    origin && `${origin}/api/v2/summary.json`,
    origin && `${origin}/history.rss`,
    origin && `${origin}/feed.rss`,
    origin && `${origin}/rss`,
    origin && `${origin}/index.json`,
    origin && `${origin}/feed.atom`,
    origin && `${origin}/api/v1/components`,
    base && `https://${base}.statuspage.io/api/v2/summary.json`,
    base && `https://${base}.instatus.com/summary.json`,
    base && `https://${base}.status.io/api/v2/summary`,
    base && `https://${base}.freshstatus.io/rss`,
    base && `https://www.${base}status.com/api/v2/summary.json`,
    base && `https://${base}status.com/api/v2/summary.json`,
    base && `https://status.${base}.com/api/v2/summary.json`,
    host && `https://${host}/summary.json`,
    host && `https://${host}/api/site-status`,
  ].filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u));

  let hit: { url: string; kind: string; code: number } | null = null;
  const rejected: string[] = [];

  for (const url of [...new Set(candidates)]) {
    const v = await verify(url);
    if (v.ok && v.kind) {
      hit = { url, kind: v.kind, code: v.code ?? 200 };
      break;
    }
    if (url.includes("summary") || url.includes("/feed") || url.includes(".rss") || url.includes("/rss")) {
      rejected.push(`${v.why ?? "?"} ${url}`);
    }
  }

  if (hit) {
    console.log(`OK   ${slug.padEnd(22)} ${hit.code} ${hit.kind.padEnd(4)} ${hit.url}`);
  } else {
    console.log(`KO   ${slug.padEnd(22)} ${html ? "page lue" : "page inaccessible"}`);
    for (const r of rejected.slice(0, 3)) console.log(`       ${r}`);
  }
}

async function main() {
  for (const slug of BROKEN) await discover(slug);
}

main();
