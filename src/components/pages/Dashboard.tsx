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
