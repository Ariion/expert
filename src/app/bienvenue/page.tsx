import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Paiement confirmé — votre surveillance démarre",
  description: "Votre abonnement StatusPulse est actif. Un lien de connexion vient de partir vers votre boîte mail.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/bienvenue" },
};

/**
 * Écran de retour après un paiement fait sans compte préalable. Il n'attend
 * rien de Stripe : l'abonnement est déjà enregistré par le webhook. Son seul
 * rôle est d'expliquer où trouver le lien de connexion, pour qu'un acheteur ne
 * reste jamais devant une page qui lui demande un mot de passe qu'il n'a pas.
 */
export default function BienvenuePage() {
  return (
    <div className="wrap">
      <section className="hero">
        <span className="pill">Paiement confirmé</span>
        <h1>Votre surveillance est active</h1>
        <p className="lead">
          Nous venons de vous envoyer un <strong>lien de connexion</strong> à l&apos;adresse utilisée
          pour le paiement. Un clic suffit : aucun mot de passe à créer.
        </p>
      </section>

      <section className="grid two">
        <div className="card">
          <h2 style={{ fontSize: 17, marginTop: 0 }}>Ce qui se passe maintenant</h2>
          <ol className="muted" style={{ fontSize: 14, paddingLeft: 18, margin: 0 }}>
            <li style={{ marginBottom: 8 }}>
              Ouvrez l&apos;email intitulé « Votre lien de connexion » (vérifiez les indésirables).
            </li>
            <li style={{ marginBottom: 8 }}>
              Choisissez les fournisseurs à surveiller depuis votre tableau de bord.
            </li>
            <li>
              Dès qu&apos;un incident est publié sur leur status page officielle, l&apos;alerte part.
            </li>
          </ol>
        </div>
        <div className="card">
          <h2 style={{ fontSize: 17, marginTop: 0 }}>Vous ne trouvez pas l&apos;email ?</h2>
          <p className="muted" style={{ fontSize: 14 }}>
            Demandez-en un nouveau avec la même adresse : votre abonnement y est déjà rattaché.
          </p>
          <Link className="btn" href="/login" style={{ width: "100%", textAlign: "center" }}>
            Recevoir un nouveau lien
          </Link>
        </div>
      </section>
    </div>
  );
}
