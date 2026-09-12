import { destroySession } from "@/lib/auth";
import { redirectTo } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await destroySession();
  return redirectTo("/");
}
