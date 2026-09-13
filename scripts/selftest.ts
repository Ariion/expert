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
import { fetchFeed, hashIncident } from "../src/lib/feeds";
import { APP_URL } from "../src/lib/env";
import { splitSqlStatements } from "../src/lib/sqlfile";
import { readFileSync } from "node:fs";

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
    [{ APP_URL: "https://statuspulse.app" }, "https://statuspulse.app", "valeur explicite"],
    [{ APP_URL: "https://statuspulse.app/" }, "https://statuspulse.app", "slash final retiré"],
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
