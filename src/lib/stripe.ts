import Stripe from "stripe";
import { sql } from "./db";
import { env, APP_URL } from "./env";
import { PLANS, planFromPriceId, type PlanId } from "./plans";
import { DEFAULT_LOCALE, href, type Locale } from "./i18n";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    client = new Stripe(env().STRIPE_SECRET_KEY, {
      // Version d'API non épinglée ici : le SDK utilise celle pour laquelle il
      // a été généré, ce qui garantit que les types TypeScript correspondent
      // exactement aux champs renvoyés.
      maxNetworkRetries: 3, // idempotence réseau gérée par le SDK
      timeout: 20000,
      telemetry: false,
    });
  }
  return client;
}

export function priceIdFor(plan: PlanId): string {
  const key = PLANS[plan].priceEnvKey;
  if (!key) throw new Error(`Le plan ${plan} n'est pas facturable.`);
  return env()[key];
}

/** Un seul customer Stripe par utilisateur, réutilisé à vie. */
export async function ensureCustomer(user: {
  id: string;
  email: string;
  stripe_customer_id: string | null;
}): Promise<string> {
  if (user.stripe_customer_id) return user.stripe_customer_id;

  const customer = await stripe().customers.create(
    { email: user.email, metadata: { user_id: user.id } },
    { idempotencyKey: `customer:${user.id}` },
  );
  await sql`update users set stripe_customer_id = ${customer.id} where id = ${user.id}`;
  return customer.id;
}

export async function createCheckoutSession(
  user: { id: string; email: string; stripe_customer_id: string | null },
  plan: PlanId,
  locale: Locale = DEFAULT_LOCALE,
): Promise<string> {
  const customerId = await ensureCustomer(user);
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceIdFor(plan), quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    // Stripe Tax n'est pas actif par défaut sur un compte neuf, et l'activer
    // sans inscription fiscale fait échouer le paiement. On l'allume par
    // variable d'environnement, le jour où le seuil de TVA l'impose.
    automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === "true" },
    customer_update: { address: "auto", name: "auto" },
    // Stripe traduit son propre tunnel ; sans ce réglage il le rend dans la
    // langue du navigateur, qui n'est pas forcément celle de la page d'où
    // vient l'acheteur.
    locale,
    subscription_data: { metadata: { user_id: user.id, plan, locale } },
    metadata: { user_id: user.id, plan, locale },
    client_reference_id: user.id,
    success_url: `${APP_URL()}${href(locale, "/dashboard")}?upgraded=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL()}${href(locale, "/pricing")}?canceled=1`,
  });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de checkout.");
  return session.url;
}

/**
 * Paiement sans compte préalable.
 *
 * Exiger une inscription avant de payer coûte la majorité des conversions :
 * on inverse l'ordre. Stripe collecte l'email au moment du paiement, crée le
 * customer, et le webhook `checkout.session.completed` fabrique le compte puis
 * envoie un lien de connexion. L'acheteur ne saisit qu'une seule fois son
 * email, et jamais de mot de passe.
 */
export async function createAnonymousCheckoutSession(
  plan: PlanId,
  locale: Locale = DEFAULT_LOCALE,
  email?: string,
): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    // Pas de `customer` : Stripe en crée un à partir de l'email saisi. Les
    // paramètres `customer_update` ne sont donc pas applicables ici.
    customer_email: email && email.includes("@") ? email : undefined,
    line_items: [{ price: priceIdFor(plan), quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === "true" },
    locale,
    subscription_data: { metadata: { plan, signup: "checkout_first", locale } },
    metadata: { plan, signup: "checkout_first", locale },
    // La langue voyage dans les métadonnées ET dans l'URL de retour : le
    // webhook crée le compte à partir des premières, l'acheteur revient par la
    // seconde, et les deux doivent concorder.
    success_url: `${APP_URL()}${
      locale === "en" ? "/en/welcome" : "/bienvenue"
    }?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL()}${href(locale, "/pricing")}?canceled=1`,
  });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de checkout.");
  return session.url;
}

export async function createPortalSession(customerId: string): Promise<string> {
  const session = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL()}/dashboard`,
  });
  return session.url;
}

/**
 * Fin de période : depuis l'API 2025-03, l'information vit sur les lignes de
 * l'abonnement, plus sur l'abonnement lui-même. On lit les deux emplacements
 * pour rester compatible avec les comptes encore sur une version antérieure.
 */
function periodEndOf(sub: Stripe.Subscription): Date | null {
  const fromItem = sub.items?.data?.[0]?.current_period_end;
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  const ts = fromItem ?? legacy;
  return ts ? new Date(ts * 1000) : null;
}

/**
 * Source de vérité = Stripe. Cette fonction projette l'état d'un abonnement
 * dans la table `users`. Appelée par le webhook ET par le cron de
 * réconciliation : même chemin de code, donc aucun état divergent possible.
 */
export async function syncSubscriptionToUser(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const priceId = sub.items.data[0]?.price?.id ?? null;

  // Un abonnement non actif ramène toujours au plan Free : aucun accès payant
  // ne survit à une annulation ou à un impayé définitif.
  const active = ["active", "trialing", "past_due"].includes(sub.status);
  const plan: PlanId = active ? planFromPriceId(priceId) : "free";

  const planStatus = ["active", "trialing", "past_due", "incomplete"].includes(sub.status)
    ? sub.status
    : "canceled";

  const periodEnd = periodEndOf(sub);

  await sql`
    update users
       set plan = ${plan},
           plan_status = ${planStatus},
           stripe_subscription_id = ${sub.id},
           current_period_end = ${periodEnd},
           cancel_at_period_end = ${sub.cancel_at_period_end ?? false}
     where stripe_customer_id = ${customerId}
  `;
}
