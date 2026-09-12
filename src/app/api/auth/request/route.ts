import { sql } from "@/lib/db";
import { findOrCreateUser, isValidEmail, sendLoginLink } from "@/lib/auth";
import { fail, redirectTo, str, tooManyTokens } from "@/lib/http";
import { ops } from "@/lib/ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = str(form, "email");
  const next = str(form, "next") || "/dashboard";

  if (!isValidEmail(email)) return fail("/login", "invalid_email");

  try {
    const user = await findOrCreateUser(email, { source: "login" });
    await sql`
      insert into alert_channels (user_id, kind, target) values (${user.id}, 'email', ${email})
      on conflict (user_id, kind, target) do nothing
    `;
    if (!(await tooManyTokens(user.id))) {
      await sendLoginLink(user.id, email, next);
    }
  } catch (err) {
    await ops.critical("auth", `Envoi du lien de connexion impossible : ${String(err)}`);
  }

  // Réponse constante, que le compte existe ou non : pas d'énumération d'emails.
  return redirectTo("/login", { sent: "1" });
}
