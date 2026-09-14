import Link from "next/link";
import { PLANS, type PlanId } from "@/lib/plans";
import { dict, href, type Locale } from "@/lib/i18n";

export function Pricing({ locale }: { locale: Locale }) {
  const t = dict(locale);

  return (
    <div className="wrap">
      <section className="hero" style={{ paddingBottom: 14 }}>
        <h1>{t.pricing.h1}</h1>
        <p className="lead">
          {t.pricing.lead} <strong>{t.pricing.leadNoAccount}</strong>
        </p>
      </section>

      <section className="grid three">
        {(Object.keys(PLANS) as PlanId[]).map((id) => {
          const plan = PLANS[id];
          const copy = t.plans[id];
          return (
            <div
              className="card"
              key={id}
              style={plan.highlight ? { borderColor: "var(--brand)" } : undefined}
            >
              {plan.highlight && <span className="pill">{t.pricing.mostChosen}</span>}
              <h2 style={{ margin: "10px 0 2px", fontSize: 19 }}>{copy.name}</h2>
              <div style={{ fontSize: 30, fontWeight: 750, letterSpacing: "-0.02em" }}>
                {copy.priceLabel}
              </div>
              <ul className="muted" style={{ fontSize: 14, paddingLeft: 18, minHeight: 150 }}>
                {copy.features.map((f) => (
                  <li key={f} style={{ marginBottom: 6 }}>
                    {f}
                  </li>
                ))}
              </ul>
              {id === "free" ? (
                <Link
                  className="btn ghost"
                  href={href(locale, "/login")}
                  style={{ width: "100%", textAlign: "center" }}
                >
                  {t.pricing.freeCta}
                </Link>
              ) : (
                <form action="/api/stripe/checkout" method="post">
                  <input type="hidden" name="plan" value={id} />
                  <input type="hidden" name="locale" value={locale} />
                  <button className="btn" type="submit" style={{ width: "100%" }}>
                    {t.pricing.upgradeCta(copy.name)}
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </section>

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
