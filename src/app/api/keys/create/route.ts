import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { createApiKey, MAX_KEYS } from "@/lib/apikeys";
import { fail, formLocale, localized, redirectTo, str } from "@/lib/http";
import { dict } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cookie de remise en main propre : la clé ne passe jamais par l'URL. */
export const NEW_KEY_COOKIE = "sp_newkey";

export async function POST(req: Request) {
  const form = await req.formData();
  const locale = formLocale(form);
  const dashboard = localized(form, "/dashboard");
  const t = dict(locale);

  const user = await getSessionUser();
  if (!user) return redirectTo(localized(form, "/login"), { next: dashboard });
  if (user.plan !== "team") return fail(dashboard, t.errors.apiTeamOnly);

  const key = await createApiKey(user.id, str(form, "name"));
  if (!key) return fail(dashboard, t.errors.apiKeyLimit(MAX_KEYS));

  // Une minute de vie : le temps de rendre la page qui l'affiche, pas plus.
  // En clair dans un cookie httpOnly plutôt que dans l'URL, qui atterrirait
  // dans l'historique du navigateur, les journaux serveur et le référent.
  (await cookies()).set(NEW_KEY_COOKIE, key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60,
  });
  return redirectTo(dashboard, { ok: "1" });
}
