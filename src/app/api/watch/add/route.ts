import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { fail, redirectTo, str } from "@/lib/http";
import { planFor } from "@/lib/plans";
import { limitReachedEmail, sendEmail } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return redirectTo("/login", { next: "/dashboard" });

  const form = await req.formData();
  const serviceId = str(form, "service_id");
  const minImpact = ["minor", "major", "critical"].includes(str(form, "min_impact"))
    ? str(form, "min_impact")
    : "minor";
  if (!serviceId) return fail("/dashboard", "Fournisseur manquant.");

  const plan = planFor(user.plan);
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from watch_items where user_id = ${user.id}
  `;

  if (n >= plan.maxServices) {
    // Le moment exact où la valeur perçue dépasse la limite : c'est là que
    // l'email d'upgrade convertit, pas dans une campagne générique.
    await sendEmail({ to: user.email, ...limitReachedEmail(n), tag: "limit-reached" }).catch(
      () => {},
    );
    return fail("/dashboard", `Limite du plan ${plan.name} atteinte (${plan.maxServices}).`);
  }

  await sql`
    insert into watch_items (user_id, service_id, min_impact)
    values (${user.id}, ${serviceId}, ${minImpact})
    on conflict (user_id, service_id) do update set min_impact = excluded.min_impact
  `;
  return redirectTo("/dashboard", { ok: "1" });
}
