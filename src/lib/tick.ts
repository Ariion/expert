import { runIngestion } from "./ingest";

/**
 * Collecte opportuniste.
 *
 * Le produit promet un état « actualisé toutes les 5 minutes ». Cette promesse
 * reposait entièrement sur un planificateur externe : le workflow GitHub
 * Actions, qui ne tient pas la cadence (deux exécutions en treize heures sur un
 * dépôt peu actif), ou un cron Vercel, réservé au plan Pro. Résultat mesuré en
 * production : 179 fournisseurs sur 197 jamais interrogés, et un accueil qui
 * affichait malgré tout « 196 opérationnels ».
 *
 * Plutôt que de dépendre d'une horloge qu'on ne contrôle pas, on profite du
 * trafic. L'accueil est en ISR à 300 secondes : chaque régénération est un
 * moment où quelqu'un, ou un crawler, attend une réponse. On y accroche un lot
 * court, exécuté après l'envoi de la réponse (`after`), donc sans ajouter une
 * milliseconde au visiteur.
 *
 * Trois raisons pour lesquelles ce n'est pas dangereux :
 *
 * 1. `claim_services_for_fetch` réserve déjà chaque service avec un bail. Deux
 *    exécutions simultanées ne traitent jamais le même fournisseur : le travail
 *    se répartit, il ne se duplique pas.
 * 2. Le lot est volontairement petit et borné dans le temps. Un pic de trafic
 *    produit plusieurs petits lots, jamais un troupeau de collectes pleine
 *    longueur.
 * 3. Un site sans visiteur n'a personne à qui mentir sur sa fraîcheur. La
 *    collecte s'arrête avec le trafic, et c'est le comportement voulu.
 *
 * Le garde-fou en mémoire est propre à chaque instance lambda : il ne protège
 * pas d'une rafale inter-instances, et ne cherche pas à le faire. C'est le bail
 * côté base qui tient ce rôle, celui-ci ne fait qu'éviter qu'une même instance
 * relance un lot à chaque rendu qu'elle enchaîne.
 *
 * Note : on n'écrit volontairement rien dans `cron_runs`. Cette table alimente
 * le watchdog, et y verser un job synthétique reviendrait à lui mentir sur la
 * santé du vrai planificateur, celui qu'il faut surveiller justement parce
 * qu'il est en panne.
 */

/** Cadence minimale entre deux lots, par instance. */
const MIN_GAP_MS = 30_000;

/** Assez pour progresser, assez peu pour ne jamais peser. */
const BATCH = 8;
const CONCURRENCY = 4;
const BUDGET_MS = 6_000;

let lastRunAt = 0;

/**
 * Échappatoire d'exploitation : `OPPORTUNISTIC_INGEST=0` rend le site
 * strictement dépendant du planificateur, comme avant. Utile pour comparer les
 * deux régimes, ou couper la collecte pendant une migration de base.
 */
export async function opportunisticIngest(): Promise<void> {
  if (process.env.OPPORTUNISTIC_INGEST === "0") return;

  const now = Date.now();
  if (now - lastRunAt < MIN_GAP_MS) return;
  lastRunAt = now;

  try {
    await runIngestion(BATCH, CONCURRENCY, now + BUDGET_MS);
  } catch {
    /* Une collecte opportuniste ne doit jamais faire échouer une page. */
  }
}
