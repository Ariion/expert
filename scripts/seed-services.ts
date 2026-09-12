/**
 * Amorce (ou met à jour) le catalogue de services.
 *
 *   npm run db:seed            -> insère/actualise le catalogue
 *   npm run db:seed -- --check -> vérifie en plus que chaque flux répond
 *
 * Idempotent : relancer le script après avoir ajouté des lignes dans
 * data/services.ts ne touche pas aux données d'ingestion existantes.
 */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { SEED_SERVICES } from "../data/services";

// Petit chargeur .env (évite une dépendance de plus pour un script one-shot).
for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* fichier absent : les variables viennent de l'environnement */
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquant.");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 2 });

async function main() {
  let inserted = 0;
  let updated = 0;

  for (const s of SEED_SERVICES) {
    const rows = await sql<{ created: boolean }[]>`
      insert into services (slug, name, category, description, homepage, status_page_url,
                            feed_url, feed_kind, logo_domain)
      values (${s.slug}, ${s.name}, ${s.category}, ${s.description}, ${s.homepage},
              ${s.status_page_url}, ${s.feed_url}, ${s.feed_kind}, ${s.logo_domain})
      on conflict (slug) do update
        set name = excluded.name,
            category = excluded.category,
            description = excluded.description,
            homepage = excluded.homepage,
            status_page_url = excluded.status_page_url,
            feed_url = excluded.feed_url,
            feed_kind = excluded.feed_kind,
            logo_domain = excluded.logo_domain
      returning (xmax = 0) as created
    `;
    if (rows[0]?.created) inserted++;
    else updated++;
  }

  console.log(`Catalogue : ${inserted} ajout(s), ${updated} mise(s) à jour.`);

  if (process.argv.includes("--check")) {
    console.log("\nVérification des flux…");
    const broken: string[] = [];
    await Promise.all(
      SEED_SERVICES.map(async (s) => {
        try {
          const res = await fetch(s.feed_url, {
            headers: { "user-agent": "StatusPulseBot/1.0 (+seed check)" },
            signal: AbortSignal.timeout(12000),
          });
          if (!res.ok) {
            broken.push(`${s.slug} → HTTP ${res.status}`);
          }
        } catch (err) {
          broken.push(`${s.slug} → ${String(err).slice(0, 80)}`);
        }
      }),
    );
    if (broken.length === 0) {
      console.log(`Tous les flux répondent (${SEED_SERVICES.length}/${SEED_SERVICES.length}).`);
    } else {
      console.log(`${broken.length} flux à corriger :`);
      for (const b of broken) console.log("  -", b);
      console.log(
        "\nUn flux en échec est mis en backoff automatiquement et signalé après 6 tentatives ;\n" +
          "corrigez l'URL dans data/services.ts puis relancez ce script.",
      );
    }
  }

  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
