import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connexion sans mot de passe à votre tableau de bord StatusPulse.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; next?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div className="wrap" style={{ maxWidth: 480 }}>
      <section className="hero">
        <h1 style={{ fontSize: 26 }}>Connexion</h1>
        <p className="lead" style={{ fontSize: 15 }}>
          Pas de mot de passe à retenir : vous recevez un lien de connexion valable 30 minutes.
        </p>

        {sp.sent && (
          <div className="notice ok" style={{ marginBottom: 16 }}>
            Lien envoyé. Ouvrez votre boîte mail (et le dossier indésirables, au cas où).
          </div>
        )}
        {sp.error && (
          <div className="notice bad" style={{ marginBottom: 16 }}>
            {sp.error === "invalid_token"
              ? "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau."
              : "Adresse email invalide."}
          </div>
        )}

        <form action="/api/auth/request" method="post" className="card">
          <input type="hidden" name="next" value={sp.next ?? "/dashboard"} />
          <label htmlFor="email">Adresse email</label>
          <input id="email" type="email" name="email" required autoComplete="email" placeholder="vous@entreprise.com" />
          <button className="btn" type="submit" style={{ width: "100%", marginTop: 12 }}>
            Recevoir mon lien de connexion
          </button>
        </form>
      </section>
    </div>
  );
}
