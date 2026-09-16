import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/env";
import { getAllServices, getCategories, type Service } from "@/lib/queries";
import { LOCALES, href } from "@/lib/i18n";

/**
 * Sitemap dynamique et segmenté.
 *
 * Le catalogue grandit sans redéploiement : ajouter une ligne dans `services`
 * crée une page, l'inscrit au sitemap et la fait indexer. C'est le cœur de la
 * mécanique d'acquisition — aucune action humaine dans la boucle.
 *
 * Segmentation à 5 000 URLs : très en-deçà de la limite de 50 000, et Google
 * recrawle plus volontiers de petits fichiers.
 */
const CHUNK = 5000;

// Le sitemap sort vide du build (aucune requête pendant la compilation) puis se
// remplit à la première revalidation : au plus une heure après le déploiement,
// sans rien à déclencher.
export const revalidate = 3600;

async function buildUrls(): Promise<MetadataRoute.Sitemap> {
  const base = APP_URL();
  const now = new Date();
  const urls: MetadataRoute.Sitemap = [];

  /**
   * Chaque page est déclarée une fois par langue, et chaque déclaration porte
   * les deux adresses en `alternates`. Sans ce couplage, Google voit deux pages
   * distinctes sur le même sujet et en déclasse une : la version anglaise
   * coûterait alors du trafic à la française au lieu d'en ajouter.
   */
  const push = (
    path: string,
    opts: Omit<MetadataRoute.Sitemap[number], "url" | "alternates">,
  ) => {
    const languages = Object.fromEntries(LOCALES.map((l) => [l, `${base}${href(l, path)}`]));
    for (const locale of LOCALES) {
      urls.push({ url: `${base}${href(locale, path)}`, ...opts, alternates: { languages } });
    }
  };

  push("/", { changeFrequency: "hourly", priority: 1, lastModified: now });
  push("/status", { changeFrequency: "hourly", priority: 0.9, lastModified: now });
  push("/categories", { changeFrequency: "daily", priority: 0.7, lastModified: now });
  push("/pricing", { changeFrequency: "weekly", priority: 0.8, lastModified: now });

  const [services, categories] = await Promise.all([
    getAllServices().catch((): Service[] => []),
    getCategories().catch(() => []),
  ]);

  for (const c of categories) {
    push(`/categories/${c.category}`, {
      changeFrequency: "daily",
      priority: 0.7,
      lastModified: now,
    });
  }

  for (const s of services) {
    push(`/status/${s.slug}`, {
      // Une page de statut change en permanence : on le dit au crawler.
      changeFrequency: s.current_status === "operational" ? "hourly" : "always",
      priority: 0.9,
      lastModified: s.last_incident_at ?? now,
    });
  }

  // Comparatifs intra-catégorie : la surface longue traîne.
  //
  // Volontairement bornée à quatre services par catégorie, soit six paires.
  // À dix, la combinatoire produisait 45 paires par catégorie — près de trois
  // quarts du sitemap en pages dérivées des mêmes données, sur un site encore
  // sans autorité. Deux conséquences, toutes deux coûteuses : le budget de
  // crawl part dans des pages que personne ne cherche au lieu des pages
  // fournisseur, et une majorité de pages quasi identiques dégrade la lecture
  // que le moteur fait du domaine entier.
  //
  // Les pages elles-mêmes restent servies et liées depuis chaque fiche
  // fournisseur : seule la demande explicite d'indexation disparaît. Le tri
  // étant `watcher_count desc`, la sélection cesse d'être alphabétique dès les
  // premiers utilisateurs et suit alors la demande réelle.
  const byCat = new Map<string, Service[]>();
  for (const s of services) {
    if (!byCat.has(s.category)) byCat.set(s.category, []);
    byCat.get(s.category)!.push(s);
  }
  for (const list of byCat.values()) {
    const top = list.slice(0, 4);
    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        push(`/compare/${top[i].slug}-vs-${top[j].slug}`, {
          changeFrequency: "weekly",
          priority: 0.6,
          lastModified: now,
        });
      }
    }
  }

  return urls;
}

export async function generateSitemaps() {
  const urls = await buildUrls();
  const chunks = Math.max(1, Math.ceil(urls.length / CHUNK));
  return Array.from({ length: chunks }, (_, id) => ({ id }));
}

export default async function sitemap({ id }: { id: number | string }): Promise<MetadataRoute.Sitemap> {
  // Selon la version de Next, `id` arrive en nombre ou en chaîne ("0", "0.xml").
  // On normalise : une erreur ici produit un sitemap vide, donc aucune
  // indexation — la panne la plus coûteuse et la plus silencieuse du projet.
  const index = Number.parseInt(String(id), 10);
  const safeIndex = Number.isFinite(index) ? index : 0;
  const urls = await buildUrls();
  return urls.slice(safeIndex * CHUNK, (safeIndex + 1) * CHUNK);
}
