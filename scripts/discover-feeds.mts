/**
 * Découverte de flux — pour les fournisseurs dont l'adresse déduite ne répond
 * pas, on cherche la vraie.
 *
 * Trois sources, dans l'ordre du moins coûteux au plus coûteux :
 *
 *  1. les indices laissés dans la page de statut (sous-domaine
 *     `xxx.statuspage.io`, `xxx.instatus.com`, `xxx.status.io`), qui trahissent
 *     la plateforme même quand le domaine de statut est propre au fournisseur ;
 *  2. la balise `<link rel="alternate" type="application/rss+xml">`, que
 *     presque toutes les plateformes exposent pour les lecteurs de flux ;
 *  3. les conventions d'adresse de chaque plateforme, appliquées au domaine
 *     connu.
 *
 * Chaque candidat est vérifié en le téléchargeant réellement : on ne retient
 * qu'une adresse qui renvoie du JSON ou du XML exploitable.
 */
import { SEED_SERVICES } from "../src/data/services";

const TIMEOUT_MS = 12_000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Les fournisseurs dont la sonde a montré que le flux principal ne répond pas. */
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

async function looksLikeFeed(url: string): Promise<{ ok: boolean; kind?: "json" | "xml"; code?: number }> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
      headers: { "user-agent": UA, accept: "application/json, application/xml, text/xml, */*" },
    });
    const body = await res.text();
    const head = body.trimStart().slice(0, 1);
    const kind = head === "{" ? "json" : head === "<" ? "xml" : null;
    return { ok: res.ok && kind !== null && body.length > 200, kind: kind ?? undefined, code: res.status };
  } catch {
    return { ok: false };
  }
}

function originOf(u: string): string | null {
  try {
    const url = new URL(u);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

async function discover(seedSlug: string): Promise<void> {
  const s = SEED_SERVICES.find((x) => x.slug === seedSlug);
  if (!s) {
    console.log(`?? ${seedSlug} : absent du catalogue`);
    return;
  }

  const found = new Set<string>();
  const origin = originOf(s.status_page_url) ?? "";
  let host = "";
  try {
    host = new URL(s.status_page_url).hostname;
  } catch {
    host = "";
  }
  const bare = host.replace(/^(status|www|help|support)\./, "");
  const base = bare.split(".")[0] ?? "";

  const html = await fetchText(s.status_page_url);

  if (html) {
    // Plateformes reconnaissables à leur sous-domaine.
    for (const m of html.matchAll(/https?:\/\/([a-z0-9-]+)\.(statuspage\.io|instatus\.com|status\.io|betterstack\.com|freshstatus\.io)/gi)) {
      found.add(`https://${m[1]}.${m[2]}`);
    }
    // Flux annoncé par la page elle-même.
    for (const m of html.matchAll(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*href=["']([^"']+)["']/gi)) {
      try {
        found.add(new URL(m[1], s.status_page_url).toString());
      } catch { /* href exotique */ }
    }
    for (const m of html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*type=["']application\/(?:rss|atom)\+xml["']/gi)) {
      try {
        found.add(new URL(m[1], s.status_page_url).toString());
      } catch { /* href exotique */ }
    }
  }

  const candidates = [
    ...found,
    ...(s.alt_feeds ?? []),
    origin && `${origin}/api/v2/summary.json`,
    origin && `${origin}/history.rss`,
    origin && `${origin}/feed.rss`,
    origin && `${origin}/rss`,
    origin && `${origin}/index.json`,
    base && `https://${base}.statuspage.io/api/v2/summary.json`,
    base && `https://${base}.instatus.com/summary.json`,
    base && `https://${base}.status.io/api/v2/summary`,
    host && `https://${host}/summary.json`,
    host && `https://${host}/feed.atom`,
    host && `https://${host}/feed`,
  ].filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u));

  let hit: { url: string; kind: string } | null = null;
  for (const url of [...new Set(candidates)]) {
    const r = await looksLikeFeed(url);
    if (r.ok && r.kind) {
      hit = { url, kind: r.kind === "json" ? "json" : "xml" };
      break;
    }
  }

  if (hit) {
    console.log(`OK   ${seedSlug.padEnd(22)} ${hit.kind.padEnd(4)} ${hit.url}`);
  } else {
    console.log(`KO   ${seedSlug.padEnd(22)} ${html ? "page lue, aucun flux" : "page inaccessible"}  (${s.status_page_url})`);
  }
}

async function main() {
  for (const slug of BROKEN) {
    await discover(slug);
  }
}

main();
