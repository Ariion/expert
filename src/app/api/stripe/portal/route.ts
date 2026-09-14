import { getSessionUser } from "@/lib/auth";
import { createPortalSession } from "@/lib/stripe";
import { fail, formLocale, localized, redirectTo } from "@/lib/http";
import { ops } from "@/lib/ops";
import { dict } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => new FormData());
  const t = dict(formLocale(form)).errors;
  const dashboard = localized(form, "/dashboard");

  const user = await getSessionUser();
  if (!user) return redirectTo(localized(form, "/login"), { next: dashboard });
  if (!user.stripe_customer_id) return redirectTo(localized(form, "/pricing"));

  try {
    const url = await createPortalSession(user.stripe_customer_id);
    return Response.redirect(url, 303);
  } catch (err) {
    await ops.critical("stripe", `Portail de facturation indisponible : ${String(err)}`, {
      user_id: user.id,
    });
    return fail(dashboard, t.portalUnavailable);
  }
}
