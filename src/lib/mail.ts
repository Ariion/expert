import { env, APP_URL, SITE_NAME } from "./env";
import { withRetry } from "./db";
import { DEFAULT_LOCALE, dict, href, type Locale } from "./i18n";

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
  tag?: string;
}

/**
 * Envoi transactionnel via Resend (HTTP direct : pas de SDK à charger dans
 * chaque lambda). Retry 3x avec backoff — un 429 ou un 500 transitoire ne doit
 * pas perdre une alerte.
 */
export async function sendEmail({ to, subject, html, text, tag }: SendArgs): Promise<void> {
  const e = env();
  await withRetry(
    async () => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${e.RESEND_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: e.EMAIL_FROM,
          to: [to],
          subject,
          html,
          text,
          tags: tag ? [{ name: "category", value: tag }] : undefined,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Resend ${res.status}: ${detail.slice(0, 300)}`);
      }
    },
    { attempts: 3, label: `email:${tag ?? "generic"}` },
  );
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(
  title: string,
  bodyHtml: string,
  locale: Locale = DEFAULT_LOCALE,
  footerNote?: string,
): string {
  const t = dict(locale).email;
  return `<!doctype html><html><body style="margin:0;background:#0b1020;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="padding:22px 28px;background:#101935;color:#fff;font-weight:700;font-size:15px;letter-spacing:.02em">${SITE_NAME}</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 14px;font-size:19px;line-height:1.35;color:#101935">${esc(title)}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:18px 28px;background:#f5f6fa;color:#6b7280;font-size:12px;line-height:1.6">
${footerNote ?? t.footerNote(SITE_NAME)}
<br><a href="${APP_URL()}${href(locale, "/dashboard")}" style="color:#4f46e5">${t.manageLink}</a>
</td></tr></table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:22px 0"><a href="${href}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 22px;border-radius:9px;font-weight:600;font-size:14px">${esc(
    label,
  )}</a></p>`;

const P = (html: string) =>
  `<p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.65">${html}</p>`;

// --------------------------------------------------------------------------
// Templates
// --------------------------------------------------------------------------

export function magicLinkEmail(url: string, locale: Locale = DEFAULT_LOCALE) {
  const t = dict(locale).email;
  return {
    subject: t.magicSubject(SITE_NAME),
    html: layout(t.magicTitle, P(t.magicBody) + button(url, t.magicCta), locale, t.magicFooter),
    text: t.magicText(SITE_NAME, url),
  };
}

export function welcomeEmail(serviceName?: string, locale: Locale = DEFAULT_LOCALE) {
  const t = dict(locale).email;
  const url = `${APP_URL()}${href(locale, "/dashboard")}`;
  return {
    subject: serviceName ? t.welcomeSubjectService(serviceName) : t.welcomeSubject(SITE_NAME),
    html: layout(
      serviceName ? t.welcomeTitleService(serviceName) : t.welcomeTitle,
      P(t.welcomeBody1) + P(t.welcomeBody2) + button(url, t.welcomeCta),
      locale,
    ),
    text: t.welcomeText(url),
  };
}

export function incidentEmail(args: {
  serviceName: string;
  serviceSlug: string;
  title: string;
  impact: string;
  state: string;
  kind: "opened" | "updated" | "resolved";
  url?: string | null;
  body?: string | null;
  startedAt: string;
  locale?: Locale;
}) {
  const locale = args.locale ?? DEFAULT_LOCALE;
  const t = dict(locale).email;
  const icon = args.kind === "resolved" ? "✅" : args.impact === "critical" ? "🔴" : "🟠";
  const subject = t.incidentSubject(icon, args.serviceName, t.incidentVerb[args.kind], args.title);
  const page = `${APP_URL()}${href(locale, `/status/${args.serviceSlug}`)}`;
  return {
    subject: subject.slice(0, 160),
    html: layout(
      `${args.serviceName} : ${args.title}`,
      P(t.incidentMeta(esc(args.impact), esc(args.state), esc(args.startedAt))) +
        (args.body ? P(esc(args.body.slice(0, 900))) : "") +
        button(args.url || page, t.incidentCta) +
        P(`<a href="${page}" style="color:#4f46e5">${esc(t.incidentHistory(args.serviceName))}</a>`),
      locale,
    ),
    text: `${subject}\n\n${args.impact} | ${args.state} | ${args.startedAt}\n${
      args.body?.slice(0, 900) ?? ""
    }\n\n${args.url || page}`,
  };
}

export function limitReachedEmail(count: number, locale: Locale = DEFAULT_LOCALE) {
  const t = dict(locale).email;
  const url = `${APP_URL()}${href(locale, "/pricing")}`;
  return {
    subject: t.limitSubject,
    html: layout(t.limitTitle(count), P(t.limitBody) + button(url, t.limitCta), locale),
    text: t.limitText(url),
  };
}

export function digestEmail(args: {
  rows: Array<{ name: string; slug: string; status: string; incidents: number; uptime: number }>;
  date: string;
  locale?: Locale;
}) {
  const locale = args.locale ?? DEFAULT_LOCALE;
  const t = dict(locale).email;
  const lines = args.rows
    .map(
      (r) =>
        `<tr><td style="padding:7px 0;font-size:13px;color:#111827">${esc(r.name)}</td>
         <td style="padding:7px 0;font-size:13px;color:#6b7280">${esc(r.status)}</td>
         <td style="padding:7px 0;font-size:13px;color:#6b7280;text-align:right">${r.uptime.toFixed(
           2,
         )} %</td></tr>`,
    )
    .join("");
  return {
    subject: t.digestSubject(args.date),
    html: layout(
      t.digestTitle(args.date),
      `<table role="presentation" width="100%">${lines}</table>` +
        button(`${APP_URL()}${href(locale, "/dashboard")}`, t.digestCta),
      locale,
    ),
    text: args.rows
      .map((r) => `${r.name}: ${r.status} — ${r.uptime.toFixed(2)}% (${r.incidents})`)
      .join("\n"),
  };
}

/**
 * Relance d'impayé. Inline dans le webhook auparavant, ce qui la laissait seule
 * en français quand tout le reste basculait.
 */
export function dunningEmail(locale: Locale = DEFAULT_LOCALE) {
  const t = dict(locale).email;
  const url = `${APP_URL()}${href(locale, "/dashboard")}`;
  return {
    subject: t.dunningSubject,
    html: layout(t.dunningSubject, P(t.dunningBody) + button(url, t.dunningCta), locale),
    text: `${t.dunningSubject}\n${t.dunningBody}\n${url}`,
  };
}

export function slaReportEmail(args: {
  period: string;
  rows: Array<{
    name: string;
    uptime: number;
    incidents: number;
    downtimeMinutes: number;
    worstMinutes: number | null;
  }>;
  locale?: Locale;
}) {
  const locale = args.locale ?? DEFAULT_LOCALE;
  const t = dict(locale).email;

  const dur = (min: number | null) =>
    min === null || min <= 0
      ? "—"
      : min < 60
        ? `${Math.round(min)} min`
        : `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")}`;

  const header = `<tr>
    <th align="left" style="padding:6px 0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em">${esc(t.slaColService)}</th>
    <th align="right" style="padding:6px 0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em">${esc(t.slaColUptime)}</th>
    <th align="right" style="padding:6px 0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em">${esc(t.slaColIncidents)}</th>
    <th align="right" style="padding:6px 0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em">${esc(t.slaColDowntime)}</th>
  </tr>`;

  const lines = args.rows
    .map((r) => {
      // Un mois sans interruption est l'information la plus utile du tableau :
      // il doit se repérer sans lire les chiffres.
      const color = r.downtimeMinutes > 0 ? "#b45309" : "#047857";
      return `<tr>
        <td style="padding:7px 0;font-size:13px;color:#111827;border-top:1px solid #e5e7eb">${esc(r.name)}</td>
        <td align="right" style="padding:7px 0;font-size:13px;color:${color};border-top:1px solid #e5e7eb">${r.uptime.toFixed(2)} %</td>
        <td align="right" style="padding:7px 0;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb">${r.incidents}</td>
        <td align="right" style="padding:7px 0;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb">${dur(r.downtimeMinutes)}</td>
      </tr>`;
    })
    .join("");

  const totalDown = args.rows.reduce((a, r) => a + r.downtimeMinutes, 0);
  const totalIncidents = args.rows.reduce((a, r) => a + r.incidents, 0);

  return {
    subject: t.slaSubject(args.period),
    html: layout(
      t.slaTitle(args.period),
      P(t.slaIntro(args.rows.length, totalIncidents, dur(totalDown))) +
        `<table role="presentation" width="100%" style="border-collapse:collapse">${header}${lines}</table>` +
        button(`${APP_URL()}${href(locale, "/dashboard")}`, t.slaCta),
      locale,
      t.slaFooter,
    ),
    text:
      `${t.slaTitle(args.period)}\n\n` +
      args.rows
        .map((r) => `${r.name}: ${r.uptime.toFixed(2)}% — ${r.incidents} incident(s), ${dur(r.downtimeMinutes)}`)
        .join("\n"),
  };
}
