/**
 * Sonde de flux — vérifie, hors production, si chaque fournisseur du catalogue
 * expose réellement un flux lisible à l'adresse que le code déduit.
 *
 * L'ingestion suppose Statuspage.io (~80 % du marché B2B) et fabrique
 * `https://<hôte>/api/v2/summary.json`. Pour un fournisseur qui publie ailleurs
 * (Instatus, Freshstatus, Atlassian, page maison), cette adresse et ses six
 * variantes conventionnelles tombent toutes en erreur : le service reste
 * éternellement « inconnu », sans que rien ne le signale.
 *
 * Ce script rejoue la même déduction, sans base de données ni secret, et sort
 * le vrai chiffre : combien de flux répondent.
 */
import { SEED_SERVICES, type SeedService } from "../src/data/services";

const CONCURRENCY = 12;
const TIMEOUT_MS = 12_000;

const UA =
  "Mozilla/5.0 (compatible; UpstreamStatusProbe/1.0; +https://www.upstreamstatus.com)";

type Result = {
  slug: string;
  name: string;
  ok: boolean;
  url: string;
  code: number | null;
  kind: "json" | "xml" | null;
  ms: number;
  error?: string;
};

async function tryUrl(url: string): Promise<{ ok: boolean; code: number | null; kind: "json" | "xml" | null; ms: number; error?: string }> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
      headers: { "user-agent": UA, accept: "application/json, application/xml, text/xml, */*" },
    });
    const body = await res.text();
    const head = body.trimStart().slice(0, 1);
    const kind = head === "{" ? "json" : head === "<" ? "xml" : null;
    // Un 200 qui renvoie une page d'erreur HTML ne vaut pas un flux : on exige
    // du JSON ou du XML, et un corps d'une taille plausible.
    const ok = res.ok && kind !== null && body.length > 200;
    return { ok, code: res.status, kind, ms: Date.now() - started };
  } catch (err) {
    const msg = err instanceof Error ? err.name : "error";
    return { ok: false, code: null, kind: null, ms: Date.now() - started, error: msg };
  }
}

async function probe(s: SeedService): Promise<Result> {
  const urls = [s.feed_url, ...(s.alt_feeds ?? [])];
  let last: { code: number | null; error?: string } = { code: null };
  for (const url of urls) {
    const r = await tryUrl(url);
    if (r.ok) return { slug: s.slug, name: s.name, ok: true, url, ...r };
    last = { code: r.code, error: r.error };
  }
  return {
    slug: s.slug,
    name: s.name,
    ok: false,
    url: urls[0] ?? "",
    code: last.code,
    kind: null,
    ms: 0,
    error: last.error,
  };
}

async function main() {
  const queue = [...SEED_SERVICES];
  const results: Result[] = [];
  const total = queue.length;

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      const r = await probe(s);
      results.push(r);
      const mark = r.ok ? "ok " : "KO ";
      console.log(`${mark} ${r.slug.padEnd(26)} ${String(r.code ?? "---").padEnd(5)} ${r.kind ?? "    "} ${r.url}`);
    }
  });
  await Promise.all(workers);

  const ok = results.filter((r) => r.ok);
  const ko = results.filter((r) => !r.ok);

  console.log("\n==================================================");
  console.log(`Total          : ${total}`);
  console.log(`Flux lisibles  : ${ok.length}`);
  console.log(`Flux muets     : ${ko.length}`);
  console.log("==================================================\n");

  if (ok.length > 0) {
    console.log("--- Ce qui marche ---");
    for (const r of ok.sort((a, b) => a.slug.localeCompare(b.slug))) {
      console.log(`${r.slug.padEnd(26)} ${r.url}`);
    }
    console.log("");
  }

  if (ko.length > 0) {
    console.log("--- Ce qui ne répond pas ---");
    for (const r of ko.sort((a, b) => a.slug.localeCompare(b.slug))) {
      console.log(`${r.slug.padEnd(26)} ${String(r.code ?? r.error ?? "?").padEnd(8)} ${r.url}`);
    }
  }

  const fs = await import("node:fs");
  const lines = ["slug;ok;url;code;kind", ...results.map((r) => `${r.slug};${r.ok};${r.url};${r.code ?? ""};${r.kind ?? ""}`)];
  fs.writeFileSync("probe-feeds.csv", lines.join("\n"), "utf8");
  console.log(`\nDétail écrit dans probe-feeds.csv`);
}

main();
