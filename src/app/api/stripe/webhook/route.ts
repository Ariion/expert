import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { ops } from "@/lib/ops";
import { stripe, syncSubscriptionToUser } from "@/lib/stripe";
import { sendEmail } from "@/lib/mail";
import { APP_URL } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook Stripe — le seul endroit où l'état de facturation entre dans le système.
 *
 * Trois garanties :
 *  1. signature vérifiée sur le corps brut (aucune confiance dans l'appelant) ;
 *  2. idempotence par `stripe_events.id` — Stripe rejoue, nous non ;
 *  3. échec = 500 + suppression de la trace, pour que Stripe réessaie
 *     (jusqu'à 3 jours) au lieu de perdre un paiement en silence.
 */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new NextResponse("signature manquante", { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe().webhooks.constructEvent(raw, signature, env().STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    await ops.critical("stripe-webhook", `Signature invalide : ${String(err)}`);
    return new NextResponse("signature invalide", { status: 400 });
  }

  const inserted = await sql<{ id: string }[]>`
    insert into stripe_events (id, type) values (${event.id}, ${event.type})
    on conflict (id) do nothing
    returning id
  `;
  if (inserted.length === 0) return NextResponse.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? session.metadata?.user_id ?? null;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id;

        // Filet de sécurité : si le customer n'était pas encore rattaché
        // (checkout créé hors de notre tunnel), on le rattache maintenant.
        if (userId && customerId) {
          await sql`
            update users set stripe_customer_id = ${customerId}
             where id = ${userId} and stripe_customer_id is distinct from ${customerId}
          `;
        }
        if (session.subscription) {
          const subId =
            typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const sub = await stripe().subscriptions.retrieve(subId);
          await syncSubscriptionToUser(sub);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscriptionToUser(event.data.object as Stripe.Subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        const [user] = await sql<{ email: string }[]>`
          update users set plan_status = 'past_due' where stripe_customer_id = ${customerId ?? ""}
          returning email
        `;
        if (user) {
          await sendEmail({
            to: user.email,
            subject: "Échec du paiement — vos alertes instantanées sont menacées",
            html: `<p>Le prélèvement de votre abonnement StatusPulse a échoué. Mettez à jour votre moyen de paiement pour conserver les alertes instantanées.</p><p><a href="${APP_URL()}/dashboard">Mettre à jour</a></p>`,
            text: `Échec du paiement StatusPulse. Mettez à jour votre moyen de paiement : ${APP_URL()}/dashboard`,
            tag: "dunning",
          }).catch(() => {});
        }
        await ops.warn("stripe-webhook", "Paiement échoué", { customer: customerId });
        break;
      }

      default:
        break; // les autres événements sont journalisés, pas traités
    }

    await sql`update stripe_events set payload = ${sql.json({ type: event.type })} where id = ${event.id}`;
    return NextResponse.json({ received: true });
  } catch (err) {
    // On efface la trace pour que le rejeu Stripe retraite l'événement.
    await sql`delete from stripe_events where id = ${event.id}`.catch(() => {});
    await ops.critical(
      "stripe-webhook",
      `Traitement de ${event.type} en échec : ${String(err)}`,
      { event_id: event.id },
      `webhook-fail:${event.type}`,
    );
    return new NextResponse("traitement en échec", { status: 500 });
  }
}
