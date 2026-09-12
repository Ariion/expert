import Link from "next/link";
import type { Metadata } from "next";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Tarifs — surveillance de vos fournisseurs à partir de 0 €",
  description:
    "Gratuit pour 3 fournisseurs. Pro à 19 €/mois pour 50 fournisseurs, alertes instantanées, Slack et webhooks. Team à 49 €/mois avec rapports SLA et API.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <div className="wrap">
      <section className="hero" style={{ paddingBottom: 14 }}>
        <h1>Un abonnement, zéro maintenance</h1>
        <p className="lead">
          Le prix d&apos;une heure de panne non détectée dépasse largement celui d&apos;une année
          d&apos;abonnement. Sans engagement, résiliable en un clic depuis le portail de
          facturation.
        </p>
      </section>

      <section className="grid three">
        {Object.values(PLANS).map((plan) => (
          <div
            className="card"
            key={plan.id}
            style={plan.highlight ? { borderColor: "var(--brand)" } : undefined}
          >
            {plan.highlight && <span className="pill">Le plus choisi</span>}
            <h2 style={{ margin: "10px 0 2px", fontSize: 19 }}>{plan.name}</h2>
            <div style={{ fontSize: 30, fontWeight: 750, letterSpacing: "-0.02em" }}>
              {plan.priceLabel}
            </div>
            <ul className="muted" style={{ fontSize: 14, paddingLeft: 18, minHeight: 150 }}>
              {plan.features.map((f) => (
                <li key={f} style={{ marginBottom: 6 }}>
                  {f}
                </li>
              ))}
            </ul>
            {plan.id === "free" ? (
              <Link className="btn ghost" href="/login" style={{ width: "100%", textAlign: "center" }}>
                Créer un compte gratuit
              </Link>
            ) : (
              <form action="/api/stripe/checkout" method="post">
                <input type="hidden" name="plan" value={plan.id} />
                <button className="btn" type="submit" style={{ width: "100%" }}>
                  Passer en {plan.name}
                </button>
              </form>
            )}
          </div>
        ))}
      </section>

      <section className="section">
        <h2>Questions fréquentes</h2>
        <div className="grid two">
          {[
            [
              "D'où viennent les données ?",
              "Exclusivement des pages de statut publiques des fournisseurs (format Statuspage, Atom ou RSS). Nous ne testons pas les services nous-mêmes : nous relayons ce que le fournisseur publie, sans délai d'interprétation.",
            ],
            [
              "Quel est le délai de détection ?",
              "Chaque status page est interrogée toutes les 5 minutes, et toutes les 2 minutes lorsqu'un service est déjà dégradé. L'alerte part dans la foulée sur les plans payants.",
            ],
            [
              "Puis-je résilier à tout moment ?",
              "Oui. Le portail de facturation Stripe est accessible depuis votre tableau de bord : résiliation, changement de plan, factures, moyens de paiement.",
            ],
            [
              "Que se passe-t-il si je dépasse la limite ?",
              "Rien ne casse : la surveillance des fournisseurs déjà enregistrés continue. Vous ne pouvez simplement plus en ajouter tant que vous n'avez pas changé de plan.",
            ],
          ].map(([q, a]) => (
            <div className="card" key={q}>
              <h3>{q}</h3>
              <p style={{ fontSize: 14, margin: 0 }}>{a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
