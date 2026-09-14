import Link from "next/link";
import { dict, href, type Locale } from "@/lib/i18n";

/**
 * Écran de retour après un paiement fait sans compte préalable. Il n'attend
 * rien de Stripe : l'abonnement est déjà enregistré par le webhook. Son seul
 * rôle est d'expliquer où trouver le lien de connexion, pour qu'un acheteur ne
 * reste jamais devant une page qui lui demande un mot de passe qu'il n'a pas.
 */
export function Welcome({ locale }: { locale: Locale }) {
  const t = dict(locale).welcome;

  return (
    <div className="wrap">
      <section className="hero">
        <span className="pill">{t.pill}</span>
        <h1>{t.h1}</h1>
        <p className="lead">{t.lead}</p>
      </section>

      <section className="grid two">
        <div className="card">
          <h2 style={{ fontSize: 17, marginTop: 0 }}>{t.nextTitle}</h2>
          <ol className="muted" style={{ fontSize: 14, paddingLeft: 18, margin: 0 }}>
            {t.next.map((step) => (
              <li key={step} style={{ marginBottom: 8 }}>
                {step}
              </li>
            ))}
          </ol>
        </div>
        <div className="card">
          <h2 style={{ fontSize: 17, marginTop: 0 }}>{t.missingTitle}</h2>
          <p className="muted" style={{ fontSize: 14 }}>
            {t.missingBody}
          </p>
          <Link className="btn" href={href(locale, "/login")} style={{ width: "100%", textAlign: "center" }}>
            {t.missingCta}
          </Link>
        </div>
      </section>
    </div>
  );
}
