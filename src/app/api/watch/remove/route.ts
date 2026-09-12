import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { redirectTo, str } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return redirectTo("/login", { next: "/dashboard" });

  const serviceId = str(await req.formData(), "service_id");
  if (serviceId) {
    await sql`delete from watch_items where user_id = ${user.id} and service_id = ${serviceId}`;
  }
  return redirectTo("/dashboard", { ok: "1" });
}
