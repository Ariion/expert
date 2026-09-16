/**
 * Découverte automatique du flux d'une status page.
 *
 * Une status page qui déménage ne prévient personne : son ancienne adresse
 * tombe, la page correspondante se vide, et elle disparaît des résultats de
 * recherche. Jusqu'ici la récupération reposait sur une liste d'adresses de
 * secours écrite à la main — ce qui suppose de connaître à l'avance où chaque
 * fournisseur va déménager.
 *
 * Or une status page annonce presque toujours son propre flux : dans une
 * balise `<link rel="alternate">`, dans un lien « RSS » de son pied de page, ou
 * par la plateforme qui l'héberge (Statuspage, Instatus, Better Stack). On lit
 * donc la page et on suit ce qu'elle déclare, au lieu de deviner.
 *
 * Bénéfice durable : les fournisseurs ajoutés plus tard n'ont plus besoin
 * d'adresses de secours écrites à la main, et un déménagement se répare sans
 * intervention.
 */
import { APP_URL } from "./env";

/** Limite de lecture : une status page fait quelques dizaines de Ko, pas plus. */
const MAX_HTML_BYTES = 400_000;

const FEED_HINT =
  /(\/api\/v2\/summary\.json|\/api\/v2\/status\.json|history\.rss|history\.atom|feed\.rss|feed\.atom|\.rss$|\.atom$|\/index\.json)/i;

function absolutize(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

/**
 * Extrait les adresses de flux plausibles d'une page HTML.
 *
 * Séparé du réseau pour être testable : c'est la partie qui casse quand une
 * plateforme change son balisage, et la seule qu'on puisse vérifier sans
 * dépendre d'un fournisseur tiers.
 */
export function extractFeedCandidates(html: string, baseUrl: string): string[] {
  const found: string[] = [];
  const push = (href: string | null | undefined) => {
    if (!href) return;
    const abs = absolutize(href.trim(), baseUrl);
    if (abs && /^https?:/i.test(abs) && !found.includes(abs)) found.push(abs);
  };

  // 1. Déclaration explicite — le cas propre, et le plus fréquent.
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/rel\s*=\s*["']?alternate/i.test(tag)) continue;
    if (!/type\s*=\s*["']?application\/(rss|atom)\+xml/i.test(tag)) continue;
    push(tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1]);
  }

  // 2. Plateforme d'hébergement : le domaine du flux diffère de celui de la
  //    page quand le fournisseur passe par un service tiers.
  for (const host of html.match(/https?:\/\/[a-z0-9-]+\.(instatus\.com|statuspage\.io|betteruptime\.com|status\.io)/gi) ?? []) {
    const origin = host.replace(/\/$/, "");
    push(`${origin}/summary.json`);
    push(`${origin}/api/v2/summary.json`);
    push(`${origin}/history.rss`);
  }

  // 3. Tout lien de la page qui ressemble à un flux — le pied de page des
  //    status pages porte presque toujours un « Subscribe via RSS ».
  for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    if (FEED_HINT.test(m[1])) push(m[1]);
  }

  return found.slice(0, 10);
}

/** Format déduit de l'adresse : rien à maintenir à la main. */
export function feedKindOf(url: string): "statuspage_v2" | "atom" | "rss" {
  if (/summary\.json|status\.json|index\.json|\/api\/v2\//i.test(url)) return "statuspage_v2";
  if (/\.atom(\?|$)|atom\+xml/i.test(url)) return "atom";
  return "rss";
}

/**
 * Lit la status page et renvoie les adresses de flux qu'elle déclare.
 * Ne lève jamais : une découverte impossible n'est pas un incident, c'est
 * simplement une piste de moins.
 */
export async function discoverFeeds(statusPageUrl: string): Promise<string[]> {
  try {
    const res = await fetch(statusPageUrl, {
      headers: {
        "user-agent": `UpstreamStatusBot/1.0 (+${APP_URL()}; feed discovery)`,
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) return [];

    const html = (await res.text()).slice(0, MAX_HTML_BYTES);
    // L'adresse finale sert de base : après redirection, les liens relatifs de
    // la page pointent vers le nouveau domaine, pas l'ancien.
    return extractFeedCandidates(html, res.url || statusPageUrl);
  } catch {
    return [];
  }
}
