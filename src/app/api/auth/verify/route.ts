import { sql } from "@/lib/db";
import { consumeLoginToken, createSession } from "@/lib/auth";
import { redirectTo, safePath } from "@/lib/http";
import { sendEmail, welcomeEmail } from "@/lib/mail";
import { ops } from "@/lib/ops";
import { asLocale, href } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const next = url.searchParams.get("next") ?? "/dashboard";
  // La langue vient du chemin de destination, seule information dont on
  // dispose avant d'avoir identifié le compte.
  const locale = asLocale(/^\/en(\/|$)/.test(next) ? "en" : "fr");

  const userId = await consumeLoginToken(token).catch(() => null);
  if (!userId) return redirectTo(href(locale, "/login"), { error: "invalid_token" });

  await createSession(userId);

  // Email de bienvenue : envoyé une seule fois, au moment exact où
  // l'utilisateur vient de prouver que son adresse fonctionne.
  try {
    const [user] = await sql<
      {
        email: string;
        onboarding_sent_at: Date | null;
        service_name: string | null;
        locale: string;
      }[]
    >`
      select u.email, u.onboarding_sent_at, u.locale, s.name as service_name
        from users u
        left join services s on s.id = u.signup_service_id
       where u.id = ${userId}
    `;
    if (user && !user.onboarding_sent_at) {
      const tpl = welcomeEmail(user.service_name ?? undefined, asLocale(user.locale));
      await sendEmail({ to: user.email, ...tpl, tag: "welcome" });
      await sql`update users set onboarding_sent_at = now() where id = ${userId}`;
    }
  } catch (err) {
    await ops.warn("auth", `Email de bienvenue non envoyé : ${String(err)}`, { userId });
  }

  return redirectTo(safePath(next, href(locale, "/dashboard")));
}
