/**
 * Vérification ciblée — on ne devine plus, on contrôle.
 *
 * Le moteur de découverte est instable : Cloudflare renvoie 403 au second
 * passage, certains domaines tombent en DNS, et la page d'accueil ne répond pas
 * toujours. Plutôt que de relancer une recherche hasardeuse, on vérifie une
 * liste d'adresses précises, issues du premier passage, et on garde uniquement
 * celles qui répondent vraiment du JSON ou du XML.
 */
const CANDIDATES: [slug: string, url: string][] = [
  ["bitwarden", "https://bitwarden.statuspage.io/api/v2/summary.json"],
  ["dashlane", "https://dashlane.statuspage.io/api/v2/summary.json"],
  ["drift", "https://drift.instatus.com/summary.json"],
  ["onelogin", "https://onelogin.statuspage.io/api/v2/summary.json"],
  ["qonto", "https://qonto.statuspage.io/api/v2/summary.json"],
  ["ringcentral", "https://ringcentral.statuspage.io/api/v2/summary.json"],
  ["sonarcloud", "https://sonarsource.statuspage.io/api/v2/summary.json"],
  ["spotify", "https://spotifystatus.statuspage.io/api/v2/summary.json"],
  ["square", "https://squareup.statuspage.io/api/v2/summary.json"],
  ["storyblok", "https://storyblok.statuspage.io/api/v2/summary.json"],
  ["typesense", "https://typesense.statuspage.io/api/v2/summary.json"],
  ["uptimerobot", "https://uptimerobot.statuspage.io/api/v2/summary.json"],
  ["fastly", "https://www.fastlystatus.com/api/v2/summary.json"],
  ["zendesk", "https://status.zendesk.com/api/v2/summary.json"],
  ["checkout-com", "https://checkout-services.statuspage.io/api/v2/summary.json"],
  ["gitlab", "https://status.gitlab.com/api/v2/summary.json"],
  ["pipedrive", "https://pipedrive.statuspage.io/api/v2/summary.json"],
  ["vonage", "https://vonage.statuspage.io/api/v2/summary.json"],
  ["vultr", "https://vultr.statuspage.io/api/v2/summary.json"],
  ["revolut-business", "https://revolut.statuspage.io/api/v2/summary.json"],
  ["x-twitter", "https://api.twitterstat.us/api/v2/summary.json"],
  ["ea", "https://ea.statuspage.io/api/v2/summary.json"],
  ["freshworks", "https://freshworks.statuspage.io/api/v2/summary.json"],
  ["minecraft", "https://minecraft.statuspage.io/api/v2/summary.json"],
  ["pinterest", "https://www.pintereststatus.com/api/v2/summary.json"],
  ["cal-com", "https://cal.statuspage.io/api/v2/summary.json"],
  ["crisp", "https://crisp.statuspage.io/api/v2/summary.json"],
  ["hetzner", "https://status.hetzner.com/de.atom"],
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function check(url: string) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
      headers: { "user-agent": UA, accept: "application/json, application/xml, text/xml, */*" },
    });
    const body = await res.text();
    const t = body.trimStart();
    if (!res.ok) return { ok: false, why: `http ${res.status}` };
    if (t.length < 200) return { ok: false, why: "corps trop court" };
    if (/^<(!doctype\s+html|html\b)/i.test(t)) return { ok: false, why: "page html" };
    if (t.startsWith("{")) {
      const p = JSON.parse(body) as Record<string, unknown>;
      const keys = Object.keys(p);
      const plausible = ["status", "components", "incidents", "data", "summary", "results"].some((k) => keys.includes(k));
      return plausible ? { ok: true, why: `json (${keys.slice(0, 3).join(",")})` } : { ok: false, why: "json inattendu" };
    }
    if (t.startsWith("<?xml") || /<(rss|feed|rdf:RDF)\b/i.test(t.slice(0, 400))) return { ok: true, why: "xml" };
    return { ok: false, why: "ni json ni xml" };
  } catch (err) {
    return { ok: false, why: err instanceof Error ? err.name : "fetch" };
  }
}

async function main() {
  const good: string[] = [];
  const bad: string[] = [];
  for (const [slug, url] of CANDIDATES) {
    const r = await check(url);
    if (r.ok) {
      good.push(slug);
      console.log(`OK   ${slug.padEnd(20)} ${r.why.padEnd(28)} ${url}`);
    } else {
      bad.push(slug);
      console.log(`KO   ${slug.padEnd(20)} ${(r.why ?? "?").padEnd(28)} ${url}`);
    }
  }
  console.log(`\nRÉSUMÉ : ${good.length} valides / ${CANDIDATES.length} testés`);
  console.log(`Valides : ${good.join(", ")}`);
  console.log(`Morts   : ${bad.join(", ")}`);
}

main();
