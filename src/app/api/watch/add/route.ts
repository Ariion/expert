import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { fail, formLocale, localized, redirectTo, str } from "@/lib/http";
import { planFor } from "@/lib/plans";
import { limitReachedEmail, sendEmail } from "@/lib/mail";
import { dict } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData();
  const locale = formLocale(form);
  const t = dict(locale);
  const dashboard = localized(form, "/dashboard");

  const user = await getSessionUser();
  if (!user) return redirectTo(localized(form, "/login"), { next: dashboard });

  const serviceId = str(form, "service_id");
  const minImpact = ["minor", "major", "critical"].includes(str(form, "min_impact"))
    ? str(form, "min_impact")
    : "minor";
  if (!serviceId) return fail(dashboard, t.errors.missingProvider);

  const plan = planFor(user.plan);
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from watch_items where user_id = ${user.id}
  `;

  if (n >= plan.maxServices) {
    // Le moment exact où la valeur perçue dépasse la limite : c'est là que
    // l'email d'upgrade convertit, pas dans une campagne générique.
    await sendEmail({
      to: user.email,
      ...limitReachedEmail(n, locale),
      tag: "limit-reached",
    }).catch(() => {});
    return fail(dashboard, t.errors.planLimit(t.plans[plan.id].name, plan.maxServices));
  }

  await sql`
    insert into watch_items (user_id, service_id, min_impact)
    values (${user.id}, ${serviceId}, ${minImpact})
    on conflict (user_id, service_id) do update set min_impact = excluded.min_impact
  `;
  return redirectTo(dashboard, { ok: "1" });
}
