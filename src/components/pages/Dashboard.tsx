import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { getSessionUser } from "@/lib/auth";
import {
  getAllServices,
  getUserAlertHistory,
  getUserChannels,
  getUserWatchlist,
} from "@/lib/queries";
import { planFor } from "@/lib/plans";
import { listApiKeys, MAX_KEYS } from "@/lib/apikeys";
import { NEW_KEY_COOKIE } from "@/app/api/keys/create/route";
import { cookies } from "next/headers";
import { APP_URL } from "@/lib/env";
import { fmtDate, timeAgo } from "@/lib/format";
import { categoryLabel, dict, href, type Locale } from "@/lib/i18n";

export async function Dashboard({
  locale,
  upgraded,
  ok,
  error,
}: {
  locale: Locale;
  upgraded?: string;
  ok?: string;
  error?: string;
}) {
  const t = dict(locale);
  const L = (p: string) => href(locale, p);

  const user = await getSessionUser();
  if (!user) redirect(`${L("/login")}?next=${encodeURIComponent(L("/dashboard"))}`);

  const [watchlist, channels, services, history] = await Promise.all([
    getUserWatchlist(user.id).catch(() => []),
    getUserChannels(user.id).catch(() => []),
    getAllServices().catch(() => []),
    getUserAlertHistory(user.id, 8).catch(() => []),
  ]);

  // Clés d'API : chargées seulement pour le plan qui y a droit, et la clé
  // fraîchement créée est reprise dans son cookie éphémère — c'est le seul
  // instant où elle est lisible, elle n'existe nulle part ailleurs en clair.
  const isTeam = user.plan === "team";
  const apiKeys = isTeam ? await listApiKeys(user.id).catch(() => []) : [];
  const freshKey = isTeam ? ((await cookies()).get(NEW_KEY_COOKIE)?.value ?? null) : null;

  const plan = planFor(user.plan);
  const copy = t.plans[plan.id];
  const watchedIds = new Set(watchlist.map((w) => w.id));
  const available = services.filter((s) => !watchedIds.has(s.id));
  const atLimit = watchlist.length >= plan.maxServices;

  return (
    <div className="wrap">
      <section className="hero" style={{ paddingBottom: 14 }}>
        <div className="between">
          <div>
            <h1 style={{ fontSize: 26, marginBottom: 6 }}>{t.dashboard.h1}</h1>
            <div className="dim">{user.email}</div>
          </div>
          <form action="/api/auth/logout" method="post">
            <input type="hidden" name="locale" value={locale} />
            <button className="btn ghost sm" type="submit">
              {t.dashboard.logout}
            </button>
          </form>
        </div>
      </section>

      {upgraded && <div className="notice ok">{t.dashboard.upgraded}</div>}
      {ok && <div className="notice ok">{t.dashboard.saved}</div>}
      {error && <div className="notice bad">{error}</div>}

      <section className="section grid two">
        <div className="card">
          <div className="between">
            <div>
              <div className="dim">{t.dashboard.currentPlan}</div>
              <h3 style={{ fontSize: 20, margin: "4px 0" }}>
                {copy.name} · {copy.priceLabel}
              </h3>
              <div className="dim">
                {t.dashboard.planSummary(
                  watchlist.length,
                  plan.maxServices,
                  plan.alertDelayMinutes > 0
                    ? t.dashboard.delayed(plan.alertDelayMinutes)
                    : t.dashboard.instant,
                )}
                {user.current_period_end &&
                  t.dashboard.renewal(
                    Boolean(user.cancel_at_period_end),
                    fmtDate(user.current_period_end),
                  )}
              </div>
            </div>
            {user.stripe_customer_id ? (
              <form action="/api/stripe/portal" method="post">
                <input type="hidden" name="locale" value={locale} />
                <button className="btn ghost sm" type="submit">
                  {t.dashboard.manageBilling}
                </button>
              </form>
            ) : (
              <Link className="btn sm" href={L("/pricing")}>
                {t.dashboard.upgradeCta}
              </Link>
            )}
          </div>
          {user.plan_status === "past_due" && (
            <div className="notice bad" style={{ marginTop: 14 }}>
              {t.dashboard.pastDue}
            </div>
          )}
        </div>

        <div className="card">
          <h3>{t.dashboard.channelsTitle}</h3>
          <div className="stack" style={{ marginTop: 10 }}>
            {channels.map((c) => (
              <div className="between" key={c.id}>
                <div>
                  <span className="pill">{c.kind}</span>{" "}
                  <span className="mono">{c.target.slice(0, 48)}</span>
                  {!c.is_active && <span className="dim"> · {t.dashboard.disabled}</span>}
                </div>
                <form action="/api/channels/remove" method="post">
                  <input type="hidden" name="channel_id" value={c.id} />
                  <input type="hidden" name="locale" value={locale} />
                  <button className="btn danger sm" type="submit">
                    {t.dashboard.remove}
                  </button>
                </form>
              </div>
            ))}
            {channels.length === 0 && <div className="dim">{t.dashboard.noChannels}</div>}
          </div>

          <form action="/api/channels/add" method="post" style={{ marginTop: 16 }}>
            <input type="hidden" name="locale" value={locale} />
            <div className="row">
              <select name="kind" aria-label={t.dashboard.channelKind} style={{ flex: "0 0 130px" }}>
                <option value="email">Email</option>
                <option value="slack">Slack</option>
                <option value="webhook">Webhook</option>
              </select>
              <input
                type="text"
                name="target"
                placeholder={t.dashboard.channelTarget}
                required
                aria-label={t.dashboard.destination}
              />
              <button className="btn sm" type="submit">
                {t.dashboard.add}
              </button>
            </div>
            {plan.id === "free" && (
              <div className="dim" style={{ marginTop: 8 }}>
                {t.dashboard.paidChannels}
              </div>
            )}
          </form>
        </div>
      </section>

      <section className="section">
        <div className="between">
          <h2 style={{ margin: 0 }}>{t.dashboard.watchedTitle}</h2>
          <div className="flex" style={{ gap: 14 }}>
            <span className="dim">
              {watchlist.length}/{plan.maxServices}
            </span>
            {/* Réservé aux plans payants : la page de tarifs le promet, et
                jusqu'ici elle le promettait sans le livrer. */}
            {plan.id !== "free" && (
              <a
                className="btn ghost sm"
                href={`/api/export/incidents?from=${encodeURIComponent(href(locale, "/dashboard"))}`}
              >
                {t.dashboard.exportCta}
              </a>
            )}
          </div>
        </div>

        <div className="card" style={{ marginTop: 12, padding: 6 }}>
          <table>
            <tbody>
              {watchlist.map((w) => (
                <tr key={w.id}>
                  <td>
                    <Link href={L(`/status/${w.slug}`)}>{w.name}</Link>
                    <div className="dim">{categoryLabel(w.category, locale)}</div>
                  </td>
                  <td>
                    <StatusBadge status={w.current_status} locale={locale} />
                  </td>
                  <td className="dim">
                    {t.dashboard.lastIncident} {timeAgo(w.last_incident_at, locale)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <form action="/api/watch/remove" method="post">
                      <input type="hidden" name="service_id" value={w.id} />
                      <input type="hidden" name="locale" value={locale} />
                      <button className="btn danger sm" type="submit">
                        {t.dashboard.unwatch}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {watchlist.length === 0 && (
                <tr>
                  <td className="dim">{t.dashboard.noWatched}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form action="/api/watch/add" method="post" className="card" style={{ marginTop: 14 }}>
          <input type="hidden" name="locale" value={locale} />
          <label htmlFor="service_id">{t.dashboard.addProvider}</label>
          <div className="row">
            <select id="service_id" name="service_id" required disabled={atLimit}>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {categoryLabel(s.category, locale)}
                </option>
              ))}
            </select>
            <select name="min_impact" aria-label={t.dashboard.threshold} style={{ flex: "0 0 190px" }}>
              <option value="minor">{t.dashboard.thresholdAll}</option>
              <option value="major">{t.dashboard.thresholdMajor}</option>
              <option value="critical">{t.dashboard.thresholdCritical}</option>
            </select>
            <button className="btn" type="submit" disabled={atLimit}>
              {t.dashboard.watchCta}
            </button>
          </div>
          {atLimit && (
            <div className="notice" style={{ marginTop: 12 }}>
              {t.dashboard.limitReached(copy.name)}{" "}
              <Link href={L("/pricing")}>{t.dashboard.limitCta}</Link>
              {t.dashboard.limitSuffix}
            </div>
          )}
        </form>
      </section>

      {isTeam && (
        <section className="section">
          <div className="between">
            <h2 style={{ margin: 0 }}>{t.dashboard.apiTitle}</h2>
            <span className="dim">
              {apiKeys.length}/{MAX_KEYS}
            </span>
          </div>
          <p className="dim" style={{ margin: "6px 0 12px", fontSize: 13.5 }}>
            {t.dashboard.apiIntro}
          </p>

          {freshKey && (
            <div className="notice ok" style={{ marginBottom: 12 }}>
              <strong>{t.dashboard.apiNewKey}</strong>
              <div className="mono" style={{ margin: "8px 0", wordBreak: "break-all", fontSize: 13 }}>
                {freshKey}
              </div>
              <span className="dim">{t.dashboard.apiNewKeyWarning}</span>
            </div>
          )}

          <div className="card" style={{ padding: 6 }}>
            <table>
              <tbody>
                {apiKeys.map((k) => (
                  <tr key={k.id}>
                    <td>{k.name}</td>
                    <td className="mono dim">{k.prefix}…</td>
                    <td className="dim">
                      {k.last_used_at ? t.dashboard.apiLastUsed(timeAgo(k.last_used_at, locale)) : t.dashboard.apiNeverUsed}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <form method="POST" action="/api/keys/revoke">
                        <input type="hidden" name="id" value={k.id} />
                        <input type="hidden" name="locale" value={locale} />
                        <button className="btn danger sm" type="submit">
                          {t.dashboard.apiRevoke}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {apiKeys.length === 0 && (
                  <tr>
                    <td className="dim">{t.dashboard.apiNoKeys}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {apiKeys.length < MAX_KEYS && (
            <form method="POST" action="/api/keys/create" className="row" style={{ marginTop: 12 }}>
              <input type="hidden" name="locale" value={locale} />
              <input type="text" name="name" placeholder={t.dashboard.apiNamePlaceholder} maxLength={60} />
              <button className="btn" type="submit">
                {t.dashboard.apiCreate}
              </button>
            </form>
          )}

          <details style={{ marginTop: 14 }}>
            <summary className="dim" style={{ cursor: "pointer", fontSize: 13 }}>
              {t.dashboard.apiDocs}
            </summary>
            <pre
              className="mono"
              style={{
                marginTop: 10,
                padding: 14,
                background: "var(--bg-soft)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                overflowX: "auto",
                fontSize: 12.5,
              }}
            >
{`curl -H "Authorization: Bearer usk_…" \\
  ${APP_URL()}/api/v1/status

curl -H "Authorization: Bearer usk_…" \\
  ${APP_URL()}/api/v1/incidents?days=30&limit=100`}
            </pre>
          </details>
        </section>
      )}

      <section className="section">
        <h2>{t.dashboard.alertsTitle}</h2>
        <div className="card" style={{ padding: 6 }}>
          <table>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>
                    <Link href={L(`/status/${h.service_slug}`)}>{h.service_name}</Link>
                  </td>
                  <td>{h.title}</td>
                  <td className="dim">{h.event_kind}</td>
                  <td className="dim">{h.status}</td>
                  <td className="dim">{timeAgo(h.sent_at ?? h.created_at, locale)}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td className="dim">{t.dashboard.noAlerts}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
