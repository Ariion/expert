import { env, APP_URL, SITE_NAME } from "./env";
import { withRetry } from "./db";

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

function layout(title: string, bodyHtml: string, footerNote?: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0b1020;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="padding:22px 28px;background:#101935;color:#fff;font-weight:700;font-size:15px;letter-spacing:.02em">${SITE_NAME}</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 14px;font-size:19px;line-height:1.35;color:#101935">${esc(title)}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:18px 28px;background:#f5f6fa;color:#6b7280;font-size:12px;line-height:1.6">
${footerNote ?? `Vous recevez cet email parce que vous surveillez des fournisseurs sur ${SITE_NAME}.`}
<br><a href="${APP_URL()}/dashboard" style="color:#4f46e5">Gérer mes alertes</a>
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

export function magicLinkEmail(url: string) {
  return {
    subject: `Votre lien de connexion ${SITE_NAME}`,
    html: layout(
      "Connexion en un clic",
      P("Ce lien est valable 30 minutes et ne fonctionne qu'une seule fois.") + button(url, "Ouvrir mon tableau de bord"),
      "Si vous n'avez pas demandé ce lien, ignorez cet email.",
    ),
    text: `Connexion ${SITE_NAME} : ${url}\n(valable 30 minutes, usage unique)`,
  };
}

export function welcomeEmail(serviceName?: string) {
  const url = `${APP_URL()}/dashboard`;
  return {
    subject: serviceName
      ? `Surveillance de ${serviceName} activée`
      : `Votre surveillance ${SITE_NAME} est active`,
    html: layout(
      serviceName ? `Vous êtes alerté dès que ${serviceName} tombe` : "Surveillance active",
      P(
        "Nous interrogeons les status pages officielles de vos fournisseurs toutes les 5 minutes. Dès qu'un incident est publié, vous recevez l'alerte — sans avoir à ouvrir quoi que ce soit.",
      ) +
        P(
          "<strong>Ajoutez le reste de votre stack</strong> : la panne qui vous coûtera cher est rarement celle que vous surveilliez déjà.",
        ) +
        button(url, "Ajouter mes fournisseurs"),
    ),
    text: `Surveillance active. Ajoutez vos fournisseurs : ${url}`,
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
}) {
  const icon = args.kind === "resolved" ? "✅" : args.impact === "critical" ? "🔴" : "🟠";
  const verb =
    args.kind === "resolved" ? "résolu" : args.kind === "updated" ? "mis à jour" : "en cours";
  const subject = `${icon} ${args.serviceName} — incident ${verb} : ${args.title}`;
  const page = `${APP_URL()}/status/${args.serviceSlug}`;
  return {
    subject: subject.slice(0, 160),
    html: layout(
      `${args.serviceName} : ${args.title}`,
      P(
        `<strong>Impact :</strong> ${esc(args.impact)} &nbsp;·&nbsp; <strong>État :</strong> ${esc(
          args.state,
        )} &nbsp;·&nbsp; <strong>Début :</strong> ${esc(args.startedAt)}`,
      ) +
        (args.body ? P(esc(args.body.slice(0, 900))) : "") +
        button(args.url || page, "Voir le détail de l'incident") +
        P(`<a href="${page}" style="color:#4f46e5">Historique complet de ${esc(args.serviceName)}</a>`),
    ),
    text: `${subject}\n\nImpact: ${args.impact} | État: ${args.state} | Début: ${args.startedAt}\n${
      args.body?.slice(0, 900) ?? ""
    }\n\n${args.url || page}`,
  };
}

export function limitReachedEmail(count: number) {
  const url = `${APP_URL()}/pricing`;
  return {
    subject: "Vous avez atteint la limite du plan Free",
    html: layout(
      `${count} fournisseurs surveillés — la limite Free est de 3`,
      P(
        "Passez en Pro pour surveiller jusqu'à 50 fournisseurs, recevoir les alertes <strong>sans délai de 15 minutes</strong>, et les router vers Slack ou un webhook.",
      ) + button(url, "Passer en Pro — 19 €/mois"),
    ),
    text: `Limite Free atteinte. Passez en Pro : ${url}`,
  };
}

export function digestEmail(args: {
  rows: Array<{ name: string; slug: string; status: string; incidents: number; uptime: number }>;
  date: string;
}) {
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
    subject: `Disponibilité de votre stack — ${args.date}`,
    html: layout(
      `Récapitulatif du ${args.date}`,
      `<table role="presentation" width="100%">${lines}</table>` +
        button(`${APP_URL()}/dashboard`, "Ouvrir le tableau de bord"),
    ),
    text: args.rows
      .map((r) => `${r.name}: ${r.status} — ${r.uptime.toFixed(2)}% (${r.incidents} incidents)`)
      .join("\n"),
  };
}
