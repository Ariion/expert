import { getSessionUser } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/stripe";
import { fail, redirectTo, str } from "@/lib/http";
import { ops } from "@/lib/ops";
import { PAID_PLANS, type PlanId } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function start(plan: string) {
  const user = await getSessionUser();
  if (!user) {
    // Après connexion, on revient directement ici : le tunnel de paiement
    // n'est jamais interrompu par une étape à refaire.
    return redirectTo("/login", { next: `/api/stripe/checkout?plan=${plan}` });
  }
  if (!PAID_PLANS.includes(plan as PlanId)) return fail("/pricing", "Plan inconnu.");

  try {
    const url = await createCheckoutSession(user, plan as PlanId);
    return Response.redirect(url, 303);
  } catch (err) {
    await ops.critical("stripe", `Création du checkout impossible : ${String(err)}`, {
      user_id: user.id,
      plan,
    });
    return fail("/pricing", "Le paiement est momentanément indisponible. Réessayez dans un instant.");
  }
}

export async function POST(req: Request) {
  return start(str(await req.formData(), "plan"));
}

export async function GET(req: Request) {
  return start(new URL(req.url).searchParams.get("plan") ?? "pro");
}
