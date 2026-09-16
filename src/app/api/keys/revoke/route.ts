import { getSessionUser } from "@/lib/auth";
import { revokeApiKey } from "@/lib/apikeys";
import { localized, redirectTo, str } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData();
  const dashboard = localized(form, "/dashboard");

  const user = await getSessionUser();
  if (!user) return redirectTo(localized(form, "/login"), { next: dashboard });

  await revokeApiKey(user.id, str(form, "id"));
  return redirectTo(dashboard, { ok: "1" });
}
