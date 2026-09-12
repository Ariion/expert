import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/env";
import { getAllServices, getCategories, type Service } from "@/lib/queries";

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

async function buildUrls(): Promise<MetadataRoute.Sitemap> {
  const base = APP_URL();
  const now = new Date();

  const urls: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "hourly", priority: 1, lastModified: now },
    { url: `${base}/status`, changeFrequency: "hourly", priority: 0.9, lastModified: now },
    { url: `${base}/categories`, changeFrequency: "daily", priority: 0.7, lastModified: now },
    { url: `${base}/pricing`, changeFrequency: "weekly", priority: 0.8, lastModified: now },
  ];

  const [services, categories] = await Promise.all([
    getAllServices().catch((): Service[] => []),
    getCategories().catch(() => []),
  ]);

  for (const c of categories) {
    urls.push({
      url: `${base}/categories/${c.category}`,
      changeFrequency: "daily",
      priority: 0.7,
      lastModified: now,
    });
  }

  for (const s of services) {
    urls.push({
      url: `${base}/status/${s.slug}`,
      // Une page de statut change en permanence : on le dit au crawler.
      changeFrequency: s.current_status === "operational" ? "hourly" : "always",
      priority: 0.9,
      lastModified: s.last_incident_at ?? now,
    });
  }

  // Comparatifs intra-catégorie : la surface longue traîne.
  const byCat = new Map<string, Service[]>();
  for (const s of services) {
    if (!byCat.has(s.category)) byCat.set(s.category, []);
    byCat.get(s.category)!.push(s);
  }
  for (const list of byCat.values()) {
    const top = list.slice(0, 10);
    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        urls.push({
          url: `${base}/compare/${top[i].slug}-vs-${top[j].slug}`,
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
