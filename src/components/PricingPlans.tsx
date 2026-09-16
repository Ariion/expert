"use client";

import { useState } from "react";
import Link from "next/link";
import type { Billing, PlanId } from "@/lib/plans";

export interface PlanCard {
  id: PlanId;
  name: string;
  features: string[];
  highlight: boolean;
  /** Libellés pré-calculés côté serveur : une fonction ne traverse pas la frontière. */
  monthlyLabel: string;
  yearlyLabel: string | null;
  yearlyEquivalent: string | null;
  yearlySaving: string | null;
  paid: boolean;
  /** Libellé du bouton, déjà traduit : `upgradeCta` est une fonction, et une
      fonction ne peut pas être passée à un composant client. */
  cta: string;
}

export interface PricingCopy {
  monthly: string;
  yearly: string;
  saveBadge: string;
  mostChosen: string;
  freeHref: string;
  locale: string;
}

/**
 * Grille tarifaire avec choix de la périodicité.
 *
 * Le sélecteur est le seul morceau interactif de la page ; il vit ici plutôt
 * que dans la page pour que le reste du site reste rendu côté serveur. Le
 * choix voyage jusqu'à Stripe dans un champ caché du formulaire, donc le
 * paiement fonctionne même si ce composant n'a pas pu s'hydrater.
 */
export function PricingPlans({
  plans,
  copy,
  yearlyAvailable,
}: {
  plans: PlanCard[];
  copy: PricingCopy;
  yearlyAvailable: boolean;
}) {
  const [billing, setBilling] = useState<Billing>(yearlyAvailable ? "yearly" : "monthly");
  const yearly = yearlyAvailable && billing === "yearly";

  return (
    <>
      {yearlyAvailable && (
        <div className="billing-switch" role="group">
          <button
            type="button"
            className={billing === "monthly" ? "on" : ""}
            onClick={() => setBilling("monthly")}
          >
            {copy.monthly}
          </button>
          <button
            type="button"
            className={billing === "yearly" ? "on" : ""}
            onClick={() => setBilling("yearly")}
          >
            {copy.yearly}
            <span className="save">{copy.saveBadge}</span>
          </button>
        </div>
      )}

      <section className="grid three">
        {plans.map((plan) => {
          const showYearly = yearly && plan.yearlyLabel !== null;
          return (
            <div
              className="card"
              key={plan.id}
              style={plan.highlight ? { borderColor: "var(--brand)" } : undefined}
            >
              {plan.highlight && <span className="pill">{copy.mostChosen}</span>}
              <h2 style={{ margin: "10px 0 2px", fontSize: 19 }}>{plan.name}</h2>
              <div style={{ fontSize: 30, fontWeight: 750, letterSpacing: "-0.02em" }}>
                {showYearly ? plan.yearlyLabel : plan.monthlyLabel}
              </div>

              {/* Hauteur réservée : basculer la périodicité ne doit pas faire
                  sauter les trois cartes les unes par rapport aux autres. */}
              <div className="billing-note dim">
                {showYearly && plan.yearlyEquivalent ? (
                  <>
                    {plan.yearlyEquivalent}
                    {plan.yearlySaving && <strong className="save-note"> · {plan.yearlySaving}</strong>}
                  </>
                ) : null}
              </div>

              <ul className="muted" style={{ fontSize: 14, paddingLeft: 18, minHeight: 150 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ marginBottom: 6 }}>
                    {f}
                  </li>
                ))}
              </ul>

              {plan.paid ? (
                <form action="/api/stripe/checkout" method="post">
                  <input type="hidden" name="plan" value={plan.id} />
                  <input type="hidden" name="locale" value={copy.locale} />
                  <input type="hidden" name="billing" value={showYearly ? "yearly" : "monthly"} />
                  <button className="btn" type="submit" style={{ width: "100%" }}>
                    {plan.cta}
                  </button>
                </form>
              ) : (
                <Link
                  className="btn ghost"
                  href={copy.freeHref}
                  style={{ width: "100%", textAlign: "center" }}
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}
