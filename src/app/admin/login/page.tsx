const ERRORS: Record<string, string> = {
  wrong: "Mot de passe incorrect.",
  unconfigured:
    "ADMIN_PASSWORD n'est pas configurée sur ce déploiement — le panneau est désactivé.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? (ERRORS[sp.error] ?? "Erreur.") : null;

  return (
    <div className="wrap" style={{ maxWidth: 380, paddingTop: 90 }}>
      <div className="card stack">
        <h1 style={{ fontSize: 22, margin: 0 }}>Admin</h1>
        <p className="dim" style={{ margin: 0 }}>Panneau interne — statistiques de visites.</p>

        {error && <p className="notice bad">{error}</p>}

        <form method="POST" action="/api/admin/login" className="stack">
          <div>
            <label htmlFor="password">Mot de passe</label>
            <input id="password" name="password" type="password" autoFocus required />
          </div>
          <button type="submit" className="btn" style={{ width: "100%" }}>
            Entrer
          </button>
        </form>
      </div>
    </div>
  );
}
