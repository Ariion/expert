import { sql } from "@/lib/db";
import { getSessionUser, isValidEmail, normalizeEmail } from "@/lib/auth";
import { fail, formLocale, localized, redirectTo, str } from "@/lib/http";
import { planFor } from "@/lib/plans";
import { dict } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData();
  const t = dict(formLocale(form)).errors;
  const dashboard = localized(form, "/dashboard");

  const user = await getSessionUser();
  if (!user) return redirectTo(localized(form, "/login"), { next: dashboard });

  const kind = str(form, "kind");
  const target = str(form, "target");
  const plan = planFor(user.plan);

  if (!["email", "webhook", "slack"].includes(kind)) return fail(dashboard, t.unknownChannel);
  if (!plan.channelKinds.includes(kind as "email" | "webhook" | "slack")) {
    return fail(dashboard, t.channelNeedsPaid(kind));
  }

  if (kind === "email" && !isValidEmail(target)) return fail(dashboard, t.invalidEmail);
  if (kind !== "email") {
    // Un webhook doit être une URL HTTPS publique : on refuse les schémas
    // exotiques et les cibles internes (protection SSRF minimale).
    let url: URL;
    try {
      url = new URL(target);
    } catch {
      return fail(dashboard, t.invalidUrl);
    }
    if (url.protocol !== "https:") return fail(dashboard, t.httpsOnly);
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[::1\])/i.test(url.hostname)) {
      return fail(dashboard, t.internalAddress);
    }
  }

  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from alert_channels where user_id = ${user.id} and is_active
  `;
  if (n >= plan.maxChannels) {
    return fail(dashboard, t.channelLimit(plan.maxChannels, plan.name));
  }

  const value = kind === "email" ? normalizeEmail(target) : target;
  await sql`
    insert into alert_channels (user_id, kind, target) values (${user.id}, ${kind}, ${value})
    on conflict (user_id, kind, target)
    do update set is_active = true, failure_count = 0, last_error = null
  `;
  return redirectTo(dashboard, { ok: "1" });
}
