import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { StatusBadge } from "@/components/StatusBadge";
import { getSessionUser } from "@/lib/auth";
import {
  getAllServices,
  getUserAlertHistory,
  getUserChannels,
  getUserWatchlist,
} from "@/lib/queries";
import { planFor } from "@/lib/plans";
import { fmtDate, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tableau de bord",
  robots: { index: false, follow: false },
};

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string; error?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard");

  const [watchlist, channels, services, history] = await Promise.all([
    getUserWatchlist(user.id).catch(() => []),
    getUserChannels(user.id).catch(() => []),
    getAllServices().catch(() => []),
    getUserAlertHistory(user.id, 8).catch(() => []),
  ]);

  const plan = planFor(user.plan);
  const watchedIds = new Set(watchlist.map((w) => w.id));
  const available = services.filter((s) => !watchedIds.has(s.id));
  const atLimit = watchlist.length >= plan.maxServices;

  return (
    <div className="wrap">
      <section className="hero" style={{ paddingBottom: 14 }}>
        <div className="between">
          <div>
            <h1 style={{ fontSize: 26, marginBottom: 6 }}>Tableau de bord</h1>
            <div className="dim">{user.email}</div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="btn ghost sm" type="submit">
              Se déconnecter
            </button>
          </form>
        </div>
      </section>

      {sp.upgraded && (
        <div className="notice ok">
          Paiement confirmé. Votre plan est activé — les alertes partent désormais sans délai.
        </div>
      )}
      {sp.ok && <div className="notice ok">Modification enregistrée.</div>}
      {sp.error && <div className="notice bad">{sp.error}</div>}

      <section className="section grid two">
        <div className="card">
          <div className="between">
            <div>
              <div className="dim">Plan actuel</div>
              <h3 style={{ fontSize: 20, margin: "4px 0" }}>
                {plan.name} · {plan.priceLabel}
              </h3>
              <div className="dim">
                {watchlist.length}/{plan.maxServices} fournisseurs ·{" "}
                {plan.alertDelayMinutes > 0
                  ? `alertes différées de ${plan.alertDelayMinutes} min`
                  : "alertes instantanées"}
                {user.current_period_end &&
                  ` · ${user.cancel_at_period_end ? "fin" : "renouvellement"} le ${fmtDate(user.current_period_end)}`}
              </div>
            </div>
            {user.stripe_customer_id ? (
              <form action="/api/stripe/portal" method="post">
                <button className="btn ghost sm" type="submit">
                  Gérer la facturation
                </button>
              </form>
            ) : (
              <Link className="btn sm" href="/pricing">
                Passer en Pro
              </Link>
            )}
          </div>
          {user.plan_status === "past_due" && (
            <div className="notice bad" style={{ marginTop: 14 }}>
              Votre dernier paiement a échoué. Mettez à jour votre moyen de paiement pour conserver
              les alertes instantanées.
            </div>
          )}
        </div>

        <div className="card">
          <h3>Canaux d&apos;alerte</h3>
          <div className="stack" style={{ marginTop: 10 }}>
            {channels.map((c) => (
              <div className="between" key={c.id}>
                <div>
                  <span className="pill">{c.kind}</span>{" "}
                  <span className="mono">{c.target.slice(0, 48)}</span>
                  {!c.is_active && <span className="dim"> · désactivé</span>}
                </div>
                <form action="/api/channels/remove" method="post">
                  <input type="hidden" name="channel_id" value={c.id} />
                  <button className="btn danger sm" type="submit">
                    Retirer
                  </button>
                </form>
              </div>
            ))}
            {channels.length === 0 && <div className="dim">Aucun canal configuré.</div>}
          </div>

          <form action="/api/channels/add" method="post" style={{ marginTop: 16 }}>
            <div className="row">
              <select name="kind" aria-label="Type de canal" style={{ flex: "0 0 130px" }}>
                <option value="email">Email</option>
                <option value="slack">Slack</option>
                <option value="webhook">Webhook</option>
              </select>
              <input
                type="text"
                name="target"
                placeholder="email ou URL du webhook"
                required
                aria-label="Destination"
              />
              <button className="btn sm" type="submit">
                Ajouter
              </button>
            </div>
            {plan.id === "free" && (
              <div className="dim" style={{ marginTop: 8 }}>
                Les canaux Slack et webhook nécessitent un plan payant.
              </div>
            )}
          </form>
        </div>
      </section>

      <section className="section">
        <div className="between">
          <h2 style={{ margin: 0 }}>Fournisseurs surveillés</h2>
          <span className="dim">
            {watchlist.length}/{plan.maxServices}
          </span>
        </div>

        <div className="card" style={{ marginTop: 12, padding: 6 }}>
          <table>
            <tbody>
              {watchlist.map((w) => (
                <tr key={w.id}>
                  <td>
                    <Link href={`/status/${w.slug}`}>{w.name}</Link>
                    <div className="dim">{w.category}</div>
                  </td>
                  <td>
                    <StatusBadge status={w.current_status} />
                  </td>
                  <td className="dim">Dernier incident : {timeAgo(w.last_incident_at)}</td>
                  <td style={{ textAlign: "right" }}>
                    <form action="/api/watch/remove" method="post">
                      <input type="hidden" name="service_id" value={w.id} />
                      <button className="btn danger sm" type="submit">
                        Ne plus suivre
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {watchlist.length === 0 && (
                <tr>
                  <td className="dim">Aucun fournisseur surveillé pour l&apos;instant.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form action="/api/watch/add" method="post" className="card" style={{ marginTop: 14 }}>
          <label htmlFor="service_id">Ajouter un fournisseur</label>
          <div className="row">
            <select id="service_id" name="service_id" required disabled={atLimit}>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.category}
                </option>
              ))}
            </select>
            <select name="min_impact" aria-label="Seuil d'alerte" style={{ flex: "0 0 190px" }}>
              <option value="minor">Tous les incidents</option>
              <option value="major">Majeurs et critiques</option>
              <option value="critical">Critiques uniquement</option>
            </select>
            <button className="btn" type="submit" disabled={atLimit}>
              Surveiller
            </button>
          </div>
          {atLimit && (
            <div className="notice" style={{ marginTop: 12 }}>
              Limite du plan {plan.name} atteinte.{" "}
              <Link href="/pricing">Passer au plan supérieur</Link> pour en ajouter davantage.
            </div>
          )}
        </form>
      </section>

      <section className="section">
        <h2>Dernières alertes envoyées</h2>
        <div className="card" style={{ padding: 6 }}>
          <table>
            <tbody>
              {history.map((h: any) => (
                <tr key={h.id}>
                  <td>
                    <Link href={`/status/${h.service_slug}`}>{h.service_name}</Link>
                  </td>
                  <td>{h.title}</td>
                  <td className="dim">{h.event_kind}</td>
                  <td className="dim">{h.status}</td>
                  <td className="dim">{timeAgo(h.sent_at ?? h.created_at)}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td className="dim">
                    Aucune alerte pour l&apos;instant — c&apos;est plutôt une bonne nouvelle.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
