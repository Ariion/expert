import { getSessionUser } from "@/lib/auth";
import { createAnonymousCheckoutSession, createCheckoutSession } from "@/lib/stripe";
import { fail, str } from "@/lib/http";
import { ops } from "@/lib/ops";
import { PAID_PLANS, type PlanId } from "@/lib/plans";

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
async function start(plan: string, email?: string) {
  if (!PAID_PLANS.includes(plan as PlanId)) return fail("/pricing", "Plan inconnu.");

  const user = await getSessionUser();

  try {
    const url = user
      ? await createCheckoutSession(user, plan as PlanId)
      : await createAnonymousCheckoutSession(plan as PlanId, email);
    return Response.redirect(url, 303);
  } catch (err) {
    await ops.critical("stripe", `Création du checkout impossible : ${String(err)}`, {
      user_id: user?.id ?? null,
      plan,
    });
    return fail("/pricing", "Le paiement est momentanément indisponible. Réessayez dans un instant.");
  }
}

export async function POST(req: Request) {
  const form = await req.formData();
  return start(str(form, "plan"), str(form, "email"));
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  return start(params.get("plan") ?? "pro", params.get("email") ?? undefined);
}
