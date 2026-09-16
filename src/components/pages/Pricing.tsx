import { PAID_PLANS, PLANS, yearlyAvailable, yearlySavingEuros, type PlanId } from "@/lib/plans";
import { WatchForm } from "@/components/WatchForm";
import { PricingPlans, type PlanCard } from "@/components/PricingPlans";
import { dict, href, type Locale } from "@/lib/i18n";

/**
 * La page de vente — la seule du site.
 *
 * Elle porte tout ce qui explique et justifie le produit, précisément parce
 * que l'accueil ne le fait plus : qui arrive ici a déjà consulté le tableau et
 * cherche à savoir ce que ça coûte et comment ça marche.
 */
export function Pricing({ locale }: { locale: Locale }) {
  const t = dict(locale);

  // Libellés calculés ici, jamais dans le composant client : les montants sont
  // la source de vérité de `plans.ts`, et une fonction de formatage ne peut pas
  // traverser la frontière serveur/client.
  const showYearly = yearlyAvailable();
  const euros = (cents: number) => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));

  const cards: PlanCard[] = (Object.keys(PLANS) as PlanId[]).map((id) => {
    const plan = PLANS[id];
    const copy = t.plans[id];
    const paid = PAID_PLANS.includes(id);
    const monthlyPerMonth = plan.monthlyCents
      ? `${t.pricing.money(euros(plan.monthlyCents))}${t.pricing.perMonth}`
      : copy.priceLabel;
    return {
      id,
      name: copy.name,
      features: copy.features,
      highlight: Boolean(plan.highlight),
      paid,
      monthlyLabel: monthlyPerMonth,
      yearlyLabel: plan.yearlyCents
        ? `${t.pricing.money(euros(plan.yearlyCents))}${t.pricing.perYear}`
        : null,
      yearlyEquivalent: plan.yearlyCents
        ? t.pricing.yearlyEquivalent(euros(Math.round(plan.yearlyCents / 12)))
        : null,
      yearlySaving: paid ? t.pricing.yearlySaving(yearlySavingEuros(id)) : null,
      cta: paid ? t.pricing.upgradeCta(copy.name) : t.pricing.freeCta,
    };
  });

  return (
    <div className="wrap">
      <section className="hero" style={{ paddingBottom: 14 }}>
        <h1>{t.pricing.h1}</h1>
        <p className="lead">
          {t.pricing.lead} <strong>{t.pricing.leadNoAccount}</strong>
        </p>
      </section>

      <section className="section grid two" style={{ marginTop: 10 }}>
        <div className="stack">
          {t.home.steps.map(([title, body]) => (
            <div className="card" key={title}>
              <h3>{title}</h3>
              <p style={{ margin: 0, fontSize: 14 }}>{body}</p>
            </div>
          ))}
        </div>
        <WatchForm locale={locale} source="pricing" />
      </section>

      <PricingPlans
        plans={cards}
        copy={{
          monthly: t.pricing.billingMonthly,
          yearly: t.pricing.billingYearly,
          saveBadge: t.pricing.billingSaveBadge,
          mostChosen: t.pricing.mostChosen,
          freeHref: href(locale, "/login"),
          locale,
        }}
        yearlyAvailable={showYearly}
      />

      <section className="section">
        <h2>{t.pricing.faqTitle}</h2>
        <div className="grid two">
          {t.pricing.faq.map(([q, a]) => (
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
