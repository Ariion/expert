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

  const channelId = str(form, "channel_id");
  if (channelId) {
    await sql`delete from alert_channels where id = ${channelId} and user_id = ${user.id}`;
  }
  return redirectTo(dashboard, { ok: "1" });
}
