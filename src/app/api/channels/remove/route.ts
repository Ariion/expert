import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { redirectTo, str } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return redirectTo("/login", { next: "/dashboard" });

  const channelId = str(await req.formData(), "channel_id");
  if (channelId) {
    await sql`delete from alert_channels where id = ${channelId} and user_id = ${user.id}`;
  }
  return redirectTo("/dashboard", { ok: "1" });
}
