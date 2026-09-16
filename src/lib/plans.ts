/**
 * Grille tarifaire — un seul endroit pour les limites produit.
 *
 * La logique de conversion est encodée ici : le plan Free est utile mais
 * volontairement contraint sur les deux axes qui font mal en production
 * (nombre de fournisseurs surveillés, et délai d'alerte).
 */
export type PlanId = "free" | "pro" | "team";

/**
 * Périodicité de facturation.
 *
 * L'annuel est payé d'avance avec deux mois offerts. Il rapporte sur trois
 * plans à la fois : la trésorerie arrive en une fois, le client ne peut plus
 * résilier avant douze mois, et le coût d'acquisition est amorti sur une année
 * entière au lieu d'un mois.
 */
export type Billing = "monthly" | "yearly";

export const BILLINGS: Billing[] = ["monthly", "yearly"];

export function asBilling(value: string | null | undefined): Billing {
  return value === "yearly" ? "yearly" : "monthly";
}

export interface Plan {
  id: PlanId;
  name: string;
  priceLabel: string;
  priceEnvKey?: "STRIPE_PRICE_PRO" | "STRIPE_PRICE_TEAM";
  /**
   * Tarif annuel — volontairement distinct et optionnel : tant qu'il n'est pas
   * créé dans Stripe, le site doit fonctionner exactement comme avant, sans
   * proposer une périodicité qu'il ne saurait pas encaisser.
   */
  yearlyEnvKey?: "STRIPE_PRICE_PRO_YEARLY" | "STRIPE_PRICE_TEAM_YEARLY";
  /** Montants en centimes, source unique pour les libellés et pour Stripe. */
  monthlyCents?: number;
  yearlyCents?: number;
  maxServices: number;
  maxChannels: number;
  /** Retard volontaire appliqué aux alertes (minutes). Le levier n°1 d'upgrade. */
  alertDelayMinutes: number;
  channelKinds: Array<"email" | "webhook" | "slack">;
  features: string[];
  highlight?: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceLabel: "0 €",
    maxServices: 3,
    maxChannels: 1,
    alertDelayMinutes: 15,
    channelKinds: ["email"],
    features: [
      "3 fournisseurs surveillés",
      "Alertes email (différées de 15 min)",
      "Historique d'incidents 90 jours",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceLabel: "19 €/mois",
    priceEnvKey: "STRIPE_PRICE_PRO",
    yearlyEnvKey: "STRIPE_PRICE_PRO_YEARLY",
    monthlyCents: 1900,
    yearlyCents: 19000,
    maxServices: 50,
    maxChannels: 5,
    alertDelayMinutes: 0,
    channelKinds: ["email", "webhook", "slack"],
    highlight: true,
    features: [
      "50 fournisseurs surveillés",
      "Alertes instantanées (< 5 min après le fournisseur)",
      "Slack + webhooks illimités",
      "Digest quotidien de disponibilité",
      "Historique complet + export",
    ],
  },
  team: {
    id: "team",
    name: "Team",
    priceLabel: "49 €/mois",
    priceEnvKey: "STRIPE_PRICE_TEAM",
    yearlyEnvKey: "STRIPE_PRICE_TEAM_YEARLY",
    monthlyCents: 4900,
    yearlyCents: 49000,
    maxServices: 500,
    maxChannels: 25,
    alertDelayMinutes: 0,
    channelKinds: ["email", "webhook", "slack"],
    features: [
      "Fournisseurs illimités en pratique (500)",
      "25 canaux (par équipe, par service)",
      "Rapports SLA mensuels automatiques",
      "Accès API en lecture",
      "Support prioritaire par email",
    ],
  },
};

export const PAID_PLANS: PlanId[] = ["pro", "team"];

export function planFor(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) ?? "free"] ?? PLANS.free;
}

/**
 * Mappe un price Stripe -> plan, pour le webhook.
 *
 * Les tarifs annuels DOIVENT figurer ici. Un identifiant non reconnu retombe
 * sur « free » : oublier l'annuel rétrograderait en Free un client qui vient
 * de payer douze mois d'avance, sans la moindre erreur visible.
 */
export function planFromPriceId(priceId: string | null | undefined): PlanId {
  if (!priceId) return "free";
  const table: Array<[string | undefined, PlanId]> = [
    [process.env.STRIPE_PRICE_TEAM, "team"],
    [process.env.STRIPE_PRICE_TEAM_YEARLY, "team"],
    [process.env.STRIPE_PRICE_PRO, "pro"],
    [process.env.STRIPE_PRICE_PRO_YEARLY, "pro"],
  ];
  for (const [candidate, plan] of table) {
    if (candidate && priceId === candidate) return plan;
  }
  return "free";
}

/** Le tarif annuel n'est proposé que s'il a été créé dans Stripe. */
export function yearlyAvailable(): boolean {
  return PAID_PLANS.every((id) => {
    const key = PLANS[id].yearlyEnvKey;
    return Boolean(key && process.env[key]?.trim());
  });
}

/** Économie annuelle, en euros entiers (deux mois offerts). */
export function yearlySavingEuros(plan: PlanId): number {
  const p = PLANS[plan];
  if (!p.monthlyCents || !p.yearlyCents) return 0;
  return Math.round((p.monthlyCents * 12 - p.yearlyCents) / 100);
}
