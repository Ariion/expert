import { getSessionUser } from "@/lib/auth";
import { createAnonymousCheckoutSession, createCheckoutSession } from "@/lib/stripe";
import { fail, str } from "@/lib/http";
import { ops } from "@/lib/ops";
import { PAID_PLANS, type PlanId } from "@/lib/plans";
import { asLocale, dict, href, type Locale } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Un seul écran entre l'envie d'acheter et le paiement : celui de Stripe.
 *
 * Un visiteur déjà connecté réutilise son customer. Un visiteur anonyme ne
 * passe plus par une inscription préalable — chaque étape ajoutée avant le
 * formulaire de carte se paie en conversions perdues. Le compte est fabriqué
 * après l'encaissement, par le webhook, à partir de l'email de facturation.
 */
async function start(plan: string, locale: Locale, email?: string) {
  const t = dict(locale).errors;
  const pricing = href(locale, "/pricing");
  if (!PAID_PLANS.includes(plan as PlanId)) return fail(pricing, t.unknownPlan);

  const user = await getSessionUser();

  try {
    const url = user
      ? await createCheckoutSession(user, plan as PlanId, user.locale)
      : await createAnonymousCheckoutSession(plan as PlanId, locale, email);
    return Response.redirect(url, 303);
  } catch (err) {
    await ops.critical("stripe", `Création du checkout impossible : ${String(err)}`, {
      user_id: user?.id ?? null,
      plan,
      locale,
    });
    return fail(pricing, t.paymentUnavailable);
  }
}

export async function POST(req: Request) {
  const form = await req.formData();
  return start(str(form, "plan"), asLocale(str(form, "locale")), str(form, "email"));
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  return start(
    params.get("plan") ?? "pro",
    asLocale(params.get("locale")),
    params.get("email") ?? undefined,
  );
}
