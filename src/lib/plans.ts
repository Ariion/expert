/**
 * Grille tarifaire — un seul endroit pour les limites produit.
 *
 * La logique de conversion est encodée ici : le plan Free est utile mais
 * volontairement contraint sur les deux axes qui font mal en production
 * (nombre de fournisseurs surveillés, et délai d'alerte).
 */
export type PlanId = "free" | "pro" | "team";

export interface Plan {
  id: PlanId;
  name: string;
  priceLabel: string;
  priceEnvKey?: "STRIPE_PRICE_PRO" | "STRIPE_PRICE_TEAM";
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

/** Mappe un price Stripe -> plan, pour le webhook. */
export function planFromPriceId(priceId: string | null | undefined): PlanId {
  if (!priceId) return "free";
  if (priceId === process.env.STRIPE_PRICE_TEAM) return "team";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  return "free";
}
