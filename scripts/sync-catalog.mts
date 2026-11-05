/**
 * RÉCONCILIATION DU CATALOGUE — `npm run catalog` (ou `npm run catalog -- --apply`)
 *
 * Pourquoi ce script existe.
 *
 * Le catalogue vit à deux endroits : `src/data/services.ts` dans le dépôt, et la
 * table `services` en production. `ensureCatalog()` insère les fournisseurs
 * manquants, mais ne réécrit jamais une ligne existante — `on conflict do
 * nothing`. C'est volontaire : un flux corrigé à la main en production ne doit
 * pas être écrasé par un déploiement.
 *
 * Le revers, c'est qu'une correction faite dans le dépôt n'atteint jamais la
 * production. Quatre adresses de flux réparées et vérifiées une par une sont
 * restées sans effet, parce que les lignes existaient déjà avec les anciennes.
 * Et personne ne s'en apercevait : le site continuait d'afficher ces
 * fournisseurs en « inconnu », ce qui ressemble à une panne chez eux.
 *
 * Ce script rend l'écart visible, puis l'applique si on le demande
 * explicitement. Par défaut il ne modifie rien.
 *
 *   npm run catalog            → diagnostic, aucune écriture
 *   npm run catalog -- --apply → insère les manquants, aligne les métadonnées,
 *                                et applique les adresses de flux divergentes
 *
 * Les métadonnées (nom, catégorie, description, page de statut) sont du texte :
 * les aligner est sans risque. Les adresses de flux sont du comportement : on
 * les signale, et on ne les écrase qu'avec `--apply`.
 */
import postgres from "postgres";
import { loadEnvFiles } from "../src/lib/envfile";
import { SEED_SERVICES } from "../src/data/services";

loadEnvFiles();

const apply = process.argv.includes("--apply");

const C = {
  b: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  ok: (s: string) => `\x1b[32m${s}\x1b[0m`,
  warn: (s: string) => `\x1b[33m${s}\x1b[0m`,
  err: (s: string) => `\x1b[31m${s}\x1b[0m`,
};

if (!process.env.DATABASE_URL) {
  console.error(`${C.err("✗")} DATABASE_URL absent.`);
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 2,
  connect_timeout: 15,
  onnotice: () => {},
});

interface Row {
  slug: string;
  name: string;
  category: string;
  description: string | null;
  homepage: string | null;
  status_page_url: string;
  feed_url: string;
  feed_kind: string;
  logo_domain: string | null;
  is_active: boolean;
}

try {
  const rows = await sql<Row[]>`
    select slug, name, category, description, homepage, status_page_url,
           feed_url, feed_kind, logo_domain, is_active
      from services
  `;
  const inDb = new Map(rows.map((r) => [r.slug, r]));
  const inSeed = new Set(SEED_SERVICES.map((s) => s.slug));

  const missing = SEED_SERVICES.filter((s) => !inDb.has(s.slug));
  const orphans = rows.filter((r) => !inSeed.has(r.slug));

  const feedDrift: { slug: string; from: string; to: string; kind: string }[] = [];
  const metaDrift: string[] = [];
  const inactive: string[] = [];

  for (const s of SEED_SERVICES) {
    const r = inDb.get(s.slug);
    if (!r) continue;

    if (r.feed_url !== s.feed_url || r.feed_kind !== s.feed_kind) {
      feedDrift.push({ slug: s.slug, from: r.feed_url, to: s.feed_url, kind: s.feed_kind });
    }
    if (
      r.name !== s.name ||
      r.category !== s.category ||
      r.status_page_url !== s.status_page_url ||
      (r.description ?? "") !== (s.description ?? "")
    ) {
      metaDrift.push(s.slug);
    }
    if (!r.is_active) inactive.push(s.slug);
  }

  console.log(`\n${C.b("Catalogue — réconciliation")}\n`);
  console.log(`  dépôt : ${SEED_SERVICES.length} fournisseurs`);
  console.log(`  base  : ${rows.length} lignes\n`);

  // --- Manquants -----------------------------------------------------------
  if (missing.length === 0) {
    console.log(`  ${C.ok("✓")} Aucun fournisseur du dépôt n'est absent de la base`);
  } else {
    console.log(`  ${C.err("✗")} ${missing.length} fournisseur(s) du dépôt absent(s) de la base :`);
    for (const s of missing) console.log(`      ${s.slug}`);
  }

  // --- Adresses divergentes ------------------------------------------------
  if (feedDrift.length === 0) {
    console.log(`  ${C.ok("✓")} Toutes les adresses de flux sont alignées`);
  } else {
    console.log(`\n  ${C.warn("!")} ${feedDrift.length} adresse(s) de flux divergent(es) :`);
    for (const d of feedDrift) {
      console.log(`      ${d.slug}`);
      console.log(`        ${C.dim("base   ")} ${d.from}`);
      console.log(`        ${C.dim("dépôt  ")} ${d.to}`);
    }
    console.log(
      C.dim(
        "\n      Une divergence n'est pas forcément une erreur : une adresse\n" +
          "      corrigée à la main en production est légitime. Vérifie laquelle\n" +
          "      est la bonne avant d'appliquer.",
      ),
    );
  }

  // --- Métadonnées ---------------------------------------------------------
  if (metaDrift.length > 0) {
    console.log(`\n  ${C.warn("!")} ${metaDrift.length} libellé(s) divergent(s) : ${metaDrift.join(", ")}`);
  }

  // --- Orphelins -----------------------------------------------------------
  if (orphans.length > 0) {
    console.log(`\n  ${C.warn("!")} ${orphans.length} ligne(s) en base absente(s) du dépôt :`);
    for (const r of orphans) console.log(`      ${r.slug}${r.is_active ? "" : C.dim(" (inactif)")}`);
    console.log(C.dim("      Elles resteront en base : aucune suppression automatique n'est faite ici."));
  }

  // --- Désactivés ----------------------------------------------------------
  if (inactive.length > 0) {
    console.log(`\n  ${C.dim(`i`)} ${inactive.length} fournisseur(s) désactivé(s) par la collecte : ${inactive.slice(0, 12).join(", ")}${inactive.length > 12 ? "…" : ""}`);
  }

  const total = missing.length + feedDrift.length + metaDrift.length;

  if (!apply) {
    console.log(
      total === 0
        ? `\n${C.ok("Rien à réconcilier.")}\n`
        : `\n${C.warn(`${total} écart(s). Relance avec --apply pour écrire.`)}\n`,
    );
    await sql.end({ timeout: 5 });
    process.exit(total === 0 ? 0 : 1);
  }

  // --- Application ---------------------------------------------------------
  console.log(`\n${C.b("Application")}`);

  let inserted = 0;
  for (const s of missing) {
    await sql`
      insert into services (slug, name, category, description, homepage, status_page_url,
                            feed_url, feed_kind, logo_domain)
      values (${s.slug}, ${s.name}, ${s.category}, ${s.description ?? null}, ${s.homepage ?? null},
              ${s.status_page_url}, ${s.feed_url}, ${s.feed_kind}, ${s.logo_domain ?? null})
      on conflict (slug) do nothing
    `;
    inserted++;
  }

  let metaUpdated = 0;
  for (const slug of metaDrift) {
    const s = SEED_SERVICES.find((x) => x.slug === slug)!;
    await sql`
      update services
         set name = ${s.name},
             category = ${s.category},
             description = ${s.description ?? null},
             homepage = ${s.homepage ?? null},
             status_page_url = ${s.status_page_url},
             logo_domain = ${s.logo_domain ?? null}
       where slug = ${slug}
    `;
    metaUpdated++;
  }

  let feedsUpdated = 0;
  for (const d of feedDrift) {
    await sql`
      update services
         set feed_url = ${d.to},
             feed_kind = ${d.kind},
             consecutive_failures = 0,
             last_error = null,
             next_fetch_at = now()
       where slug = ${d.slug}
    `;
    feedsUpdated++;
  }

  console.log(`  ${C.ok("✓")} ${inserted} inséré(s), ${metaUpdated} libellé(s) aligné(s), ${feedsUpdated} adresse(s) de flux appliquée(s)`);
  console.log(C.dim("  Les compteurs d'échec des flux modifiés sont remis à zéro et leur prochain relevé est avancé.\n"));

  await sql.end({ timeout: 5 });
  process.exit(0);
} catch (err) {
  console.error(`\n${C.err("✗")} ${String(err).slice(0, 300)}\n`);
  await sql.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
}
