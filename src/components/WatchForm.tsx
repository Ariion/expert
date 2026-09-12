/**
 * Capture email — le point de conversion du trafic SEO.
 *
 * Formulaire HTML natif (POST vers un route handler) : fonctionne sans
 * JavaScript, donc sur n'importe quel appareil et pour n'importe quel crawler.
 */
export function WatchForm({
  serviceId,
  serviceName,
  source = "status_page",
}: {
  serviceId?: string;
  serviceName?: string;
  source?: string;
}) {
  return (
    <form action="/api/subscribe" method="post" className="card" style={{ background: "var(--bg-soft)" }}>
      <h3 style={{ marginBottom: 4 }}>
        {serviceName ? `Être alerté quand ${serviceName} tombe` : "Être alerté en cas de panne"}
      </h3>
      <p style={{ fontSize: 13.5, margin: "0 0 12px" }}>
        Gratuit, 3 fournisseurs, sans carte bancaire. Vous recevez un email dès qu&apos;un incident
        est publié sur la page de statut officielle.
      </p>
      <input type="hidden" name="service_id" value={serviceId ?? ""} />
      <input type="hidden" name="source" value={source} />
      <div className="row">
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="vous@entreprise.com"
          aria-label="Adresse email"
        />
        <button className="btn" type="submit">
          Activer l&apos;alerte
        </button>
      </div>
    </form>
  );
}
