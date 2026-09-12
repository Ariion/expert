import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/env";

export const metadata: Metadata = {
  title: "Mentions légales et traitement des données",
  description: "Éditeur, hébergement, sources de données et traitement des données personnelles.",
  alternates: { canonical: "/legal" },
  robots: { index: false, follow: true },
};

export default function LegalPage() {
  return (
    <div className="wrap">
      <section className="hero" style={{ paddingBottom: 10 }}>
        <h1>Mentions légales</h1>
      </section>
      <div className="stack" style={{ maxWidth: 720 }}>
        <div className="card">
          <h3>Sources des données</h3>
          <p style={{ fontSize: 14 }}>
            {SITE_NAME} agrège et republie des informations issues des pages de statut publiques des
            fournisseurs cités, accessibles sans authentification et destinées à la diffusion
            publique. Chaque page indique sa source officielle et y renvoie. {SITE_NAME} n&apos;est
            affilié à aucun de ces fournisseurs et leurs marques restent la propriété de leurs
            détenteurs respectifs.
          </p>
        </div>
        <div className="card">
          <h3>Données personnelles</h3>
          <p style={{ fontSize: 14 }}>
            Les seules données collectées sont l&apos;adresse email nécessaire à l&apos;envoi des
            alertes, la liste des fournisseurs surveillés et les identifiants de facturation gérés
            par Stripe. Aucune revente, aucun traceur publicitaire, aucun cookie autre que le cookie
            de session. Suppression du compte et de toutes les données associées sur simple demande
            par email.
          </p>
        </div>
        <div className="card">
          <h3>Limitation de responsabilité</h3>
          <p style={{ fontSize: 14 }}>
            Le service est fourni « en l&apos;état ». Les alertes dépendent de la publication
            d&apos;incidents par les fournisseurs eux-mêmes : {SITE_NAME} ne peut garantir la
            détection d&apos;une panne qui n&apos;aurait pas été publiée sur la page de statut
            officielle.
          </p>
        </div>
      </div>
    </div>
  );
}
