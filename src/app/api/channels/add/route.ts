import { sql } from "@/lib/db";
import { getSessionUser, isValidEmail, normalizeEmail } from "@/lib/auth";
import { fail, redirectTo, str } from "@/lib/http";
import { planFor } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return redirectTo("/login", { next: "/dashboard" });

  const form = await req.formData();
  const kind = str(form, "kind");
  const target = str(form, "target");
  const plan = planFor(user.plan);

  if (!["email", "webhook", "slack"].includes(kind)) return fail("/dashboard", "Canal inconnu.");
  if (!plan.channelKinds.includes(kind as "email" | "webhook" | "slack")) {
    return fail("/dashboard", `Le canal ${kind} nécessite un plan payant.`);
  }

  if (kind === "email" && !isValidEmail(target)) return fail("/dashboard", "Email invalide.");
  if (kind !== "email") {
    // Un webhook doit être une URL HTTPS publique : on refuse les schémas
    // exotiques et les cibles internes (protection SSRF minimale).
    let url: URL;
    try {
      url = new URL(target);
    } catch {
      return fail("/dashboard", "URL invalide.");
    }
    if (url.protocol !== "https:") return fail("/dashboard", "Seules les URL HTTPS sont acceptées.");
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[::1\])/i.test(url.hostname)) {
      return fail("/dashboard", "Adresse interne refusée.");
    }
  }

  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from alert_channels where user_id = ${user.id} and is_active
  `;
  if (n >= plan.maxChannels) {
    return fail("/dashboard", `Limite de ${plan.maxChannels} canaux atteinte sur le plan ${plan.name}.`);
  }

  const value = kind === "email" ? normalizeEmail(target) : target;
  await sql`
    insert into alert_channels (user_id, kind, target) values (${user.id}, ${kind}, ${value})
    on conflict (user_id, kind, target)
    do update set is_active = true, failure_count = 0, last_error = null
  `;
  return redirectTo("/dashboard", { ok: "1" });
}
