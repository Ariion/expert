import Link from "next/link";
import type { Metadata } from "next";
import { StatusBadge } from "@/components/StatusBadge";
import { WatchForm } from "@/components/WatchForm";
import { getCategories, getGlobalStats, getRecentIncidents, getAllServices } from "@/lib/queries";
import { faviconFor, timeAgo, IMPACT_LABEL } from "@/lib/format";
import { PLANS } from "@/lib/plans";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Surveillez les status pages de tous vos fournisseurs — StatusPulse",
  description:
    "Un seul tableau de bord pour AWS, Stripe, Slack, GitHub, Twilio et 100+ fournisseurs. Alerte email, Slack ou webhook dès qu'un incident est publié. Gratuit pour 3 services.",
  alternates: { canonical: "/" },
};

export default async function Home() {
  const [stats, incidents, categories, services] = await Promise.all([
    getGlobalStats().catch(() => ({ services: 0, incidents_30d: 0, degraded_now: 0, watchers: 0 })),
    getRecentIncidents(8).catch(() => []),
    getCategories().catch(() => []),
    getAllServices().catch(() => []),
  ]);

  const trending = services.slice(0, 12);

  return (
    <div className="wrap">
      <section className="hero">
        <span className="pill">
          {stats.services} fournisseurs surveillés · {stats.incidents_30d} incidents sur 30 jours
        </span>
        <h1 style={{ marginTop: 16 }}>
          Vos clients ne devraient pas être
          <br />
          les premiers à vous dire que Stripe est down.
        </h1>
        <p className="lead">
          StatusPulse interroge en continu les pages de statut officielles de vos fournisseurs et
          vous alerte par email, Slack ou webhook dans les minutes qui suivent la publication d&apos;un
          incident. Rien à installer, rien à maintenir.
        </p>
        <div className="row" style={{ marginTop: 22 }}>
          <Link className="btn" href="/pricing">
            Commencer gratuitement
          </Link>
          <Link className="btn ghost" href="/status">
            Parcourir les fournisseurs
          </Link>
        </div>
      </section>

      <section className="section grid four">
        {[
          ["Détection", "≤ 5 min", "après publication par le fournisseur"],
          ["Fournisseurs", `${stats.services}`, "status pages suivies en continu"],
          ["En incident", `${stats.degraded_now}`, "à cet instant précis"],
          ["Intervention", "0 h", "aucune action de votre part"],
        ].map(([label, value, note]) => (
          <div className="card" key={label}>
            <div className="dim">{label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, margin: "4px 0" }}>{value}</div>
            <div className="dim">{note}</div>
          </div>
        ))}
      </section>

      <section className="section">
        <div className="between">
          <h2 style={{ margin: 0 }}>Incidents récents</h2>
          <Link href="/status" className="dim">
            Tout voir →
          </Link>
        </div>
        <div className="grid two" style={{ marginTop: 14 }}>
          {incidents.length === 0 && (
            <div className="notice">
              Aucun incident enregistré pour l&apos;instant. Le collecteur alimente cette page toutes
              les 5 minutes.
            </div>
          )}
          {incidents.map((i) => (
            <div className={`card incident ${i.impact}`} key={i.id}>
              <div className="between">
                <Link href={`/status/${i.service_slug}`} className="flex">
                  <img className="logo-img" src={faviconFor(i.logo_domain)} alt="" loading="lazy" />
                  <strong>{i.service_name}</strong>
                </Link>
                <span className="dim">{timeAgo(i.started_at)}</span>
              </div>
              <h3 style={{ marginTop: 10 }}>{i.title}</h3>
              <div className="dim">
                {IMPACT_LABEL[i.impact] ?? i.impact} ·{" "}
                {i.is_resolved ? "résolu" : "en cours"}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Fournisseurs les plus surveillés</h2>
        <div className="grid four">
          {trending.map((s) => (
            <Link className="card link" key={s.id} href={`/status/${s.slug}`}>
              <div className="flex">
                <img className="logo-img" src={faviconFor(s.logo_domain)} alt="" loading="lazy" />
                <strong>{s.name}</strong>
              </div>
              <div style={{ marginTop: 10 }}>
                <StatusBadge status={s.current_status} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section grid two">
        <div>
          <h2 style={{ marginTop: 0 }}>Comment ça marche</h2>
          <div className="stack">
            {[
              [
                "1. Choisissez votre stack",
                "Sélectionnez les fournisseurs dont dépend votre produit : cloud, paiement, email, auth, CDN…",
              ],
              [
                "2. Nous surveillons en continu",
                "Chaque status page officielle est interrogée toutes les 2 à 5 minutes, avec une cadence accélérée quand un service se dégrade.",
              ],
              [
                "3. Vous recevez l'alerte",
                "Email, Slack ou webhook signé — avant que le support client ne s'enflamme. Puis l'avis de résolution.",
              ],
            ].map(([t, d]) => (
              <div className="card" key={t}>
                <h3>{t}</h3>
                <p style={{ margin: 0, fontSize: 14 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="stack">
          <WatchForm source="home" />
          <div className="card">
            <h3>Plan {PLANS.pro.name} — {PLANS.pro.priceLabel}</h3>
            <ul className="muted" style={{ fontSize: 14, paddingLeft: 18, margin: "8px 0 14px" }}>
              {PLANS.pro.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <Link className="btn" href="/pricing">
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Par catégorie</h2>
        <div className="grid four">
          {categories.map((c) => (
            <Link className="card link" key={c.category} href={`/categories/${c.category}`}>
              <strong style={{ textTransform: "capitalize" }}>{c.category.replace(/-/g, " ")}</strong>
              <div className="dim" style={{ marginTop: 6 }}>
                {c.count} fournisseurs · {c.degraded} en incident
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
