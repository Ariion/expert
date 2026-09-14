import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { localized, redirectTo, str } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData();
  const dashboard = localized(form, "/dashboard");

  const user = await getSessionUser();
  if (!user) return redirectTo(localized(form, "/login"), { next: dashboard });

  const serviceId = str(form, "service_id");
  if (serviceId) {
    await sql`delete from watch_items where user_id = ${user.id} and service_id = ${serviceId}`;
  }
  return redirectTo(dashboard, { ok: "1" });
}
