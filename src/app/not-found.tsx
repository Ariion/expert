import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap">
      <section className="hero">
        <h1>Page introuvable</h1>
        <p className="lead">
          Ce fournisseur n&apos;est pas (encore) surveillé par StatusPulse, ou l&apos;adresse est
          erronée.
        </p>
        <div className="row" style={{ marginTop: 18 }}>
          <Link className="btn" href="/status">
            Voir tous les fournisseurs
          </Link>
          <Link className="btn ghost" href="/">
            Accueil
          </Link>
        </div>
      </section>
    </div>
  );
}
