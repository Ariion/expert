import { getSessionUser } from "@/lib/auth";
import { createPortalSession } from "@/lib/stripe";
import { fail, redirectTo } from "@/lib/http";
import { ops } from "@/lib/ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return redirectTo("/login", { next: "/dashboard" });
  if (!user.stripe_customer_id) return redirectTo("/pricing");

  try {
    const url = await createPortalSession(user.stripe_customer_id);
    return Response.redirect(url, 303);
  } catch (err) {
    await ops.critical("stripe", `Portail de facturation indisponible : ${String(err)}`, {
      user_id: user.id,
    });
    return fail("/dashboard", "Portail de facturation momentanément indisponible.");
  }
}
