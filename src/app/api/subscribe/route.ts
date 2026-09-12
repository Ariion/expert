import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { findOrCreateUser, isValidEmail, sendLoginLink } from "@/lib/auth";
import { fail, redirectTo, str, tooManyTokens } from "@/lib/http";
import { planFor } from "@/lib/plans";
import { ops } from "@/lib/ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entrée unique du tunnel de conversion.
 *
 * Un visiteur arrivé par SEO sur /status/<service> laisse son email et repart
 * avec une alerte active. Tout est enchaîné ici sans intervention :
 * création de compte, abonnement au service consulté, canal email, envoi du
 * lien de confirmation (double opt-in, indispensable pour la délivrabilité).
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const email = str(form, "email");
  const serviceId = str(form, "service_id") || null;
  const source = str(form, "source") || "direct";
  const back = serviceId ? "/login" : "/login";

  if (!isValidEmail(email)) return fail(back, "Adresse email invalide.");

  try {
    const user = await findOrCreateUser(email, { source, serviceId });

    if (serviceId) {
      const [{ plan }] = await sql<{ plan: string }[]>`select plan from users where id = ${user.id}`;
      const [{ n }] = await sql<{ n: number }[]>`
        select count(*)::int as n from watch_items where user_id = ${user.id}
      `;
      if (n < planFor(plan).maxServices) {
        await sql`
          insert into watch_items (user_id, service_id) values (${user.id}, ${serviceId})
          on conflict (user_id, service_id) do nothing
        `;
      }
    }

    // Canal email par défaut : l'utilisateur n'a rien à configurer.
    await sql`
      insert into alert_channels (user_id, kind, target) values (${user.id}, 'email', ${email})
      on conflict (user_id, kind, target) do nothing
    `;

    if (await tooManyTokens(user.id)) {
      return redirectTo(back, { sent: "1" }); // réponse identique : pas d'oracle
    }

    await sendLoginLink(user.id, email, "/dashboard");
    return redirectTo(back, { sent: "1" });
  } catch (err) {
    await ops.critical("subscribe", `Inscription impossible : ${String(err)}`, { source });
    return fail(back, "Une erreur est survenue, réessayez dans un instant.");
  }
}

export function GET() {
  return NextResponse.redirect(new URL("/pricing", process.env.APP_URL ?? "http://localhost:3000"));
}
