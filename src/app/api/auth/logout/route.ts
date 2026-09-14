import { destroySession } from "@/lib/auth";
import { localized, redirectTo } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => new FormData());
  await destroySession();
  return redirectTo(localized(form, "/"));
}
