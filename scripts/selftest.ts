/**
 * Auto-test sans base de données ni réseau externe.
 *
 *   npm run selftest
 *
 * Sert des flux de test depuis un serveur HTTP local et vérifie la chaîne
 * complète de normalisation : Statuspage JSON, Atom, RSS, en-têtes
 * conditionnels (304), déduplication par empreinte et déduction d'état.
 * À exécuter avant chaque déploiement : c'est le filet qui protège la partie
 * du système que personne ne regarde jamais.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { fetchFeed, guessImpact, hashIncident, isResolvedEntry } from "../src/lib/feeds";
import { APP_URL, normalizeUrl } from "../src/lib/env";
import { splitSqlStatements } from "../src/lib/sqlfile";
import { readFileSync } from "node:fs";
import { DICT, LOCALES, href, translatePath, categoryLabel, asLocale } from "../src/lib/i18n";
import { SEED_SERVICES } from "../src/data/services";
import { DESCRIPTIONS_EN } from "../src/data/descriptions.en";
import { extractFeedCandidates, feedKindOf } from "../src/lib/discover";
import { asBilling, planFromPriceId, yearlyAvailable, yearlySavingEuros } from "../src/lib/plans";
import { csvCell, toCsv } from "../src/lib/csv";
import { isBot } from "../src/lib/analytics";

const SUMMARY = {
  status: { indicator: "major", description: "Partial System Outage" },
  incidents: [
    {
      id: "inc_1",
      name: "Elevated API error rates",
      status: "investigating",
      impact: "major",
      shortlink: "https://stspg.io/abc",
      created_at: new Date(Date.now() - 3600_000).toISOString(),
      started_at: new Date(Date.now() - 3600_000).toISOString(),
      resolved_at: null,
      incident_updates: [{ body: "We are investigating elevated error rates." }],
    },
    {
      id: "inc_2",
      name: "Dashboard latency",
      status: "resolved",
      impact: "minor",
      created_at: new Date(Date.now() - 86_400_000).toISOString(),
      resolved_at: new Date(Date.now() - 80_000_000).toISOString(),
      incident_updates: [{ body: "Resolved." }],
    },
  ],
  scheduled_maintenances: [
    {
      id: "mnt_1",
      name: "Database upgrade",
      status: "scheduled",
      created_at: new Date().toISOString(),
      scheduled_for: new Date(Date.now() + 86_400_000).toISOString(),
      scheduled_until: null,
      incident_updates: [{ body: "Planned maintenance window." }],
    },
  ],
};

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Status</title>
  <entry>
    <id>tag:example,2026:Incident/999</id>
    <published>${new Date(Date.now() - 1800_000).toISOString()}</published>
    <updated>${new Date(Date.now() - 900_000).toISOString()}</updated>
    <link rel="alternate" href="https://status.example.com/incidents/999"/>
    <title>Major outage affecting EU region</title>
    <content type="html">&lt;p&gt;We are seeing a complete outage in eu-west.&lt;/p&gt;</content>
  </entry>
  <entry>
    <id>tag:example,2026:Incident/998</id>
    <published>${new Date(Date.now() - 6 * 86_400_000).toISOString()}</published>
    <link rel="alternate" href="https://status.example.com/incidents/998"/>
    <title>Resolved: brief login delays</title>
    <content type="html">&lt;p&gt;This incident has been resolved.&lt;/p&gt;</content>
  </entry>
</feed>`;

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Example RSS Status</title>
  <item>
    <guid>https://status.example.com/i/1</guid>
    <title>Degraded performance on webhooks</title>
    <description>Elevated error rates observed.</description>
    <pubDate>${new Date(Date.now() - 1200_000).toUTCString()}</pubDate>
    <link>https://status.example.com/i/1</link>
  </item>
</channel></rss>`;

let checks = 0;
function ok(label: string, fn: () => void) {
  fn();
  checks++;
  console.log(`  ✓ ${label}`);
}

async function main() {
  const server = createServer((req, res) => {
    if (req.url?.startsWith("/summary.json")) {
      if (req.headers["if-none-match"] === '"v1"') {
        res.writeHead(304, { etag: '"v1"' });
        return res.end();
      }
      res.writeHead(200, { "content-type": "application/json", etag: '"v1"' });
      return res.end(JSON.stringify(SUMMARY));
    }
    if (req.url?.startsWith("/atom")) {
      res.writeHead(200, { "content-type": "application/atom+xml" });
      return res.end(ATOM);
    }
    if (req.url?.startsWith("/rss")) {
      res.writeHead(200, { "content-type": "application/rss+xml" });
      return res.end(RSS);
    }
    if (req.url?.startsWith("/moved")) {
      // Une status page qui a changé de plateforme : elle sert une page
      // d'accueil en HTML, avec un code 200, à l'adresse du flux JSON.
      res.writeHead(200, { "content-type": "text/html" });
      return res.end("<!DOCTYPE html><html><body>Status page</body></html>");
    }
    res.writeHead(500);
    res.end("boom");
  });

  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;

  console.log("Statuspage v2");
  const sp = await fetchFeed({
    feed_url: `${base}/summary.json`,
    feed_kind: "statuspage_v2",
    http_etag: null,
    http_last_modified: null,
  });
  ok("indicateur global traduit en statut interne", () =>
    assert.equal(sp.status, "partial_outage"),
  );
  ok("incidents + maintenances normalisés", () => assert.equal(sp.incidents.length, 3));
  ok("incident ouvert non marqué résolu", () => {
    const open = sp.incidents.find((i) => i.externalId === "inc_1")!;
    assert.equal(open.resolvedAt, null);
    assert.equal(open.impact, "major");
  });
  ok("incident clos porte sa date de résolution", () => {
    const closed = sp.incidents.find((i) => i.externalId === "inc_2")!;
    assert.ok(closed.resolvedAt instanceof Date);
  });
  ok("maintenance planifiée typée 'maintenance'", () => {
    const mnt = sp.incidents.find((i) => i.externalId === "mnt_1")!;
    assert.equal(mnt.impact, "maintenance");
    assert.equal(mnt.state, "scheduled");
  });
  ok("ETag renvoyé pour la requête conditionnelle suivante", () =>
    assert.equal(sp.etag, '"v1"'),
  );

  const cached = await fetchFeed({
    feed_url: `${base}/summary.json`,
    feed_kind: "statuspage_v2",
    http_etag: '"v1"',
    http_last_modified: null,
  });
  ok("304 = aucun traitement, aucune alerte", () => {
    assert.equal(cached.notModified, true);
    assert.equal(cached.incidents.length, 0);
  });

  console.log("\nAtom");
  const atom = await fetchFeed({
    feed_url: `${base}/atom`,
    feed_kind: "atom",
    http_etag: null,
    http_last_modified: null,
  });
  ok("état déduit d'un incident ouvert récent", () => assert.equal(atom.status, "major_outage"));
  ok("HTML nettoyé dans le corps", () =>
    assert.ok(atom.incidents[0].body?.includes("complete outage")),
  );
  ok("'Resolved:' détecté comme résolu", () => {
    const resolved = atom.incidents.find((i) => i.title.startsWith("Resolved"))!;
    assert.ok(resolved.resolvedAt instanceof Date);
  });
  ok("lien alternate conservé", () =>
    assert.equal(atom.incidents[0].url, "https://status.example.com/incidents/999"),
  );

  console.log("\nRSS");
  const rss = await fetchFeed({
    feed_url: `${base}/rss`,
    feed_kind: "rss",
    http_etag: null,
    http_last_modified: null,
  });
  ok("dégradation détectée depuis le titre", () => {
    assert.equal(rss.status, "partial_outage");
    assert.equal(rss.incidents[0].impact, "major");
  });

  console.log("\nEmpreintes");
  ok("empreinte stable pour un contenu identique", () =>
    assert.equal(hashIncident(sp.incidents[0]), hashIncident(sp.incidents[0])),
  );
  ok("empreinte différente si l'état change", () => {
    const mutated = { ...sp.incidents[0], state: "resolved" as const };
    assert.notEqual(hashIncident(sp.incidents[0]), hashIncident(mutated));
  });

  console.log("\nURL publique");
  // Régression réelle : une variable déclarée mais VIDE (l'écran d'import de
  // Vercel crée les clés sans valeur) faisait échouer le build sur
  // « new URL('') ». Ces cas verrouillent le comportement.
  const urlCases: Array<[Record<string, string>, string, string]> = [
    [{ APP_URL: "https://upstreamstatus.com" }, "https://upstreamstatus.com", "valeur explicite"],
    [{ APP_URL: "https://upstreamstatus.com/" }, "https://upstreamstatus.com", "slash final retiré"],
    [{ APP_URL: "", VERCEL_PROJECT_PRODUCTION_URL: "expert.vercel.app" }, "https://expert.vercel.app", "vide -> domaine de production Vercel"],
    [{ APP_URL: "   ", VERCEL_URL: "expert-abc.vercel.app" }, "https://expert-abc.vercel.app", "blancs -> URL de déploiement Vercel"],
    [{ APP_URL: "pas-une-url", VERCEL_URL: "expert.vercel.app" }, "https://expert.vercel.app", "valeur invalide ignorée"],
    [{}, "http://localhost:3000", "rien de défini -> développement local"],
  ];
  for (const [vars, expected, label] of urlCases) {
    for (const k of ["APP_URL", "VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL"]) delete process.env[k];
    Object.assign(process.env, vars);
    ok(label, () => assert.equal(APP_URL(), expected));
  }
  for (const k of ["APP_URL", "VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL"]) delete process.env[k];

  console.log("\nFlux trompeurs");
  // Régression réelle : ces flux répondaient 200 avec du HTML. Un contrôle
  // limité au code HTTP les déclarait valides, et la collecte échouait ensuite
  // une fois par service et par heure — trois cents emails d'alerte.
  await assert.rejects(
    () =>
      fetchFeed({
        feed_url: `${base}/moved`,
        feed_kind: "statuspage_v2",
        http_etag: null,
        http_last_modified: null,
      }),
    /JSON|token/i,
  );
  checks++;
  console.log("  ✓ une page HTML servie en 200 à la place du JSON est rejetée");

  console.log("\nDécoupage SQL");
  // Régression réelle : le schéma envoyé d'un bloc était interrompu par le
  // pooler Supabase (« statement timeout »), laissant la base à moitié créée.
  const schema = readFileSync("supabase/schema.sql", "utf8");
  const statements = splitSqlStatements(schema);
  ok(`le schéma se découpe en instructions (${statements.length})`, () =>
    assert.ok(statements.length > 30),
  );
  ok("aucun bloc dollar-quoté n'est coupé", () => {
    for (const st of statements) assert.equal((st.match(/\$\$/g) ?? []).length % 2, 0);
  });
  ok("les corps de fonction restent entiers", () => {
    const claim = statements.find((st) => st.includes("claim_alert_deliveries"));
    assert.ok(claim?.includes("skip locked"));
    assert.ok(claim?.includes("returning d.*"));
  });
  ok("point-virgule dans une chaîne, un commentaire ou un bloc", () => {
    const tricky = splitSqlStatements(
      `select ';' as a; -- commentaire ; ici\nselect 2; /* bloc ; ici */ do $x$ begin perform 1; end $x$;`,
    );
    assert.equal(tricky.length, 3);
    assert.ok(tricky[2].includes("perform 1;"));
  });
  ok("les commentaires seuls ne produisent pas d'instruction vide", () =>
    assert.equal(splitSqlStatements("-- rien du tout\n\n-- non plus\n").length, 0),
  );

  console.log("\nJournal d'événements contre panne en cours");
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
  ok("un message informatif n'est pas une panne", () => {
    assert.equal(guessImpact("Informational message: Increased API error rates"), "minor");
    assert.equal(guessImpact("Informational message: elevated error rates in eu-west-1"), "minor");
  });
  ok("une vraie panne reste classée comme telle", () => {
    assert.equal(guessImpact("Service disruption: API unavailable"), "major");
    assert.equal(guessImpact("Major outage affecting all regions"), "critical");
    assert.equal(guessImpact("Scheduled maintenance window"), "maintenance");
  });
  ok("les marqueurs de clôture sont reconnus", () => {
    assert.equal(isResolvedEntry("[RESOLVED] API errors", "", hoursAgo(1)), true);
    assert.equal(isResolvedEntry("Service is operating normally", "", hoursAgo(1)), true);
    assert.equal(isResolvedEntry("Elevated errors", "Issue resolved at 14:02", hoursAgo(1)), true);
  });
  ok("une entrée récente non close reste ouverte", () =>
    assert.equal(isResolvedEntry("Service disruption", "We are investigating", hoursAgo(2)), false),
  );
  ok("une entrée vieille de plusieurs jours est un événement passé", () =>
    assert.equal(isResolvedEntry("Service disruption", "We are investigating", hoursAgo(24 * 5)), true),
  );

  console.log("\nAdresse du site");
  ok("un protocole manquant est complété", () => {
    assert.equal(normalizeUrl("upstreamstatus.com"), "https://upstreamstatus.com");
    assert.equal(normalizeUrl("  upstreamstatus.com//  "), "https://upstreamstatus.com");
  });
  ok("une adresse déjà complète n'est pas touchée", () => {
    assert.equal(normalizeUrl("https://x.test/a"), "https://x.test/a");
    assert.equal(normalizeUrl("http://localhost:3000"), "http://localhost:3000");
  });
  ok("ce qui n'est pas une adresse reste refusable", () => {
    assert.equal(normalizeUrl("pas une url"), "pas une url");
    assert.equal(normalizeUrl(""), "");
  });

  console.log("\nDécouverte de flux");
  ok("le flux déclaré en <link rel=alternate> est trouvé", () => {
    const html = `<html><head>
      <link rel="alternate" type="application/atom+xml" href="/history.atom" title="Incidents">
      <link rel="icon" href="/favicon.ico"></head><body></body></html>`;
    const found = extractFeedCandidates(html, "https://status.example.com/");
    assert.ok(found.includes("https://status.example.com/history.atom"));
  });
  ok("une status page hébergée ailleurs est suivie sur son vrai domaine", () => {
    const html = `<script src="https://acme.instatus.com/embed.js"></script>`;
    const found = extractFeedCandidates(html, "https://status.acme.io/");
    assert.ok(found.includes("https://acme.instatus.com/summary.json"));
  });
  ok("un lien « RSS » de pied de page est retenu", () => {
    const html = `<footer><a href="https://status.example.com/history.rss">Subscribe via RSS</a></footer>`;
    const found = extractFeedCandidates(html, "https://status.example.com/");
    assert.ok(found.includes("https://status.example.com/history.rss"));
  });
  ok("les liens sans rapport sont ignorés", () => {
    const html = `<a href="/support">Aide</a><a href="https://twitter.com/acme">X</a>
      <link rel="stylesheet" href="/style.css">`;
    assert.deepEqual(extractFeedCandidates(html, "https://status.example.com/"), []);
  });
  ok("aucun doublon, et la liste reste bornée", () => {
    const html = Array.from({ length: 40 }, (_, i) => `<a href="/f${i}.rss">f</a>`).join("") +
      `<a href="/f1.rss">doublon</a>`;
    const found = extractFeedCandidates(html, "https://status.example.com/");
    assert.equal(found.length, 10);
    assert.equal(new Set(found).size, found.length);
  });
  ok("une page illisible ne fait rien planter", () => {
    assert.deepEqual(extractFeedCandidates("", "https://status.example.com/"), []);
    assert.deepEqual(extractFeedCandidates("<link href=", "https://x.test/"), []);
  });
  ok("le format se déduit de l'adresse", () => {
    assert.equal(feedKindOf("https://x.test/api/v2/summary.json"), "statuspage_v2");
    assert.equal(feedKindOf("https://x.test/history.atom"), "atom");
    assert.equal(feedKindOf("https://x.test/history.rss"), "rss");
  });

  console.log("\nMesure d'audience");
  ok("les robots ne sont pas comptés comme des visiteurs", () => {
    // Googlebot exécute le JavaScript : sans ce filtre, il apparaît comme un
    // visiteur et gonfle les chiffres sur lesquels on décide quoi construire.
    const bots = [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
      "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0 Safari/537.36",
      "curl/8.4.0",
      "python-requests/2.31.0",
      "",
    ];
    for (const ua of bots) assert.equal(isBot(ua), true, `non filtré : ${ua || "(vide)"}`);
  });

  ok("un vrai navigateur reste compté", () => {
    const humans = [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
    ];
    for (const ua of humans) assert.equal(isBot(ua), false, `humain écarté à tort : ${ua}`);
  });

  console.log("\nExport CSV");
  ok("un titre d'incident ne peut pas décaler les colonnes", () => {
    // Les trois caractères qui cassent un CSV, et qu'on trouve réellement dans
    // les titres publiés par les fournisseurs.
    assert.equal(csvCell("Erreurs EU-West, read replica"), '"Erreurs EU-West, read replica"');
    assert.equal(csvCell('Panne "majeure"'), '"Panne ""majeure"""');
    assert.equal(csvCell("ligne1\nligne2"), '"ligne1\nligne2"');
    assert.equal(csvCell("simple"), "simple");
    assert.equal(csvCell(null), "");
    assert.equal(csvCell(undefined), "");
  });

  ok("le fichier reste lisible par un tableur", () => {
    const csv = toCsv(["a", "b"], [["x,1", 'y"2']]);
    assert.ok(csv.startsWith("\uFEFF"), "BOM absent : accents cassés dans Excel");
    const [header, row] = csv.replace("\uFEFF", "").trim().split("\r\n");
    assert.equal(header, "a,b");
    assert.equal(row, '"x,1","y""2"');
    // Une ligne = un enregistrement : le compte de colonnes doit tenir.
    assert.equal(row.split('","').length, 2);
  });

  console.log("\nFacturation");
  ok("un tarif annuel est reconnu comme payant, jamais rétrogradé en Free", () => {
    // LE test qui compte : un identifiant annuel non reconnu ferait retomber
    // en Free, silencieusement, un client qui vient de payer douze mois.
    const saved = { ...process.env };
    process.env.STRIPE_PRICE_PRO = "price_pro_m";
    process.env.STRIPE_PRICE_PRO_YEARLY = "price_pro_y";
    process.env.STRIPE_PRICE_TEAM = "price_team_m";
    process.env.STRIPE_PRICE_TEAM_YEARLY = "price_team_y";
    try {
      assert.equal(planFromPriceId("price_pro_m"), "pro");
      assert.equal(planFromPriceId("price_pro_y"), "pro");
      assert.equal(planFromPriceId("price_team_m"), "team");
      assert.equal(planFromPriceId("price_team_y"), "team");
      assert.equal(planFromPriceId("price_inconnu"), "free");
      assert.equal(planFromPriceId(null), "free");
    } finally {
      process.env = saved;
    }
  });

  ok("l'annuel n'est proposé que si les deux tarifs existent", () => {
    const saved = { ...process.env };
    try {
      delete process.env.STRIPE_PRICE_PRO_YEARLY;
      delete process.env.STRIPE_PRICE_TEAM_YEARLY;
      assert.equal(yearlyAvailable(), false, "aucun tarif annuel : ne rien proposer");

      process.env.STRIPE_PRICE_PRO_YEARLY = "price_pro_y";
      assert.equal(yearlyAvailable(), false, "un seul tarif sur deux : ne rien proposer");

      process.env.STRIPE_PRICE_TEAM_YEARLY = "price_team_y";
      assert.equal(yearlyAvailable(), true);
    } finally {
      process.env = saved;
    }
  });

  ok("deux mois offerts, et rien d'autre n'est accepté comme périodicité", () => {
    assert.equal(yearlySavingEuros("pro"), 38); // 19x12 = 228 -> 190
    assert.equal(yearlySavingEuros("team"), 98); // 49x12 = 588 -> 490
    assert.equal(asBilling("yearly"), "yearly");
    assert.equal(asBilling("monthly"), "monthly");
    assert.equal(asBilling("annuel"), "monthly");
    assert.equal(asBilling(null), "monthly");
  });

  console.log("\nBilingue");
  ok("le français reste à la racine, l'anglais sous /en", () => {
    assert.equal(href("fr", "/status/github"), "/status/github");
    assert.equal(href("en", "/status/github"), "/en/status/github");
    assert.equal(href("fr", "/"), "/");
    assert.equal(href("en", "/"), "/en");
  });
  ok("une page se traduit vers son équivalent, pas vers l'accueil", () => {
    assert.equal(translatePath("/status/stripe", "en"), "/en/status/stripe");
    assert.equal(translatePath("/status/stripe", "fr"), "/status/stripe");
    // Segment renommé : l'URL française était publiée avant l'anglaise.
    assert.equal(translatePath("/bienvenue", "en"), "/en/welcome");
    assert.equal(translatePath("/welcome", "fr"), "/bienvenue");
  });
  ok("une locale inconnue retombe sur le français", () => {
    assert.equal(asLocale("de"), "fr");
    assert.equal(asLocale(""), "fr");
    assert.equal(asLocale(null), "fr");
    assert.equal(asLocale("EN"), "en");
  });
  ok("aucune clé de traduction ne manque dans une langue", () => {
    // Une clé absente afficherait « undefined » en production, sur la page
    // même qui est censée convertir. On compare les deux arbres entiers.
    const shape = (v: unknown): unknown => {
      if (!v || typeof v !== "object" || Array.isArray(v)) return typeof v;
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .map(([k, val]): [string, unknown] => [k, shape(val)])
          .sort((a, b) => a[0].localeCompare(b[0])),
      );
    };
    assert.deepEqual(shape(DICT.fr), shape(DICT.en));
  });
  ok("chaque catégorie a une étiquette dans les deux langues", () => {
    for (const category of new Set(SEED_SERVICES.map((s) => s.category))) {
      for (const locale of LOCALES) {
        const label = categoryLabel(category, locale);
        assert.ok(label && label !== category, `${category} en ${locale}`);
      }
    }
  });
  ok("chaque fournisseur a une description anglaise", () => {
    const missing = SEED_SERVICES.filter((s) => !DESCRIPTIONS_EN[s.slug]).map((s) => s.slug);
    assert.deepEqual(missing, []);
    const orphans = Object.keys(DESCRIPTIONS_EN).filter(
      (k) => !SEED_SERVICES.some((s) => s.slug === k),
    );
    assert.deepEqual(orphans, []);
  });
  ok("les titres anglais portent la requête visée", () => {
    assert.equal(DICT.en.service.metaTitle("GitHub").startsWith("Is GitHub down?"), true);
    assert.equal(DICT.fr.service.metaTitle("GitHub").startsWith("GitHub est-il en panne"), true);
  });

  console.log("\nErreurs");
  await assert.rejects(
    () =>
      fetchFeed({
        feed_url: `${base}/broken`,
        feed_kind: "statuspage_v2",
        http_etag: null,
        http_last_modified: null,
      }),
    /HTTP 500/,
  );
  checks++;
  console.log("  ✓ une erreur HTTP remonte (déclenche le backoff côté ingestion)");

  server.close();
  console.log(`\n${checks} vérifications passées.`);
}

main().catch((err) => {
  console.error("\nÉCHEC :", err);
  process.exit(1);
});
