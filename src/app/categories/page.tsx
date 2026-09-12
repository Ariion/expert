import Link from "next/link";
import type { Metadata } from "next";
import { getCategories } from "@/lib/queries";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Catégories de fournisseurs surveillés",
  description:
    "Cloud, paiement, email, authentification, CDN, observabilité : parcourez les status pages surveillées par catégorie.",
  alternates: { canonical: "/categories" },
};

export default async function CategoriesPage() {
  const categories = await getCategories().catch(() => []);
  return (
    <div className="wrap">
      <section className="hero" style={{ paddingBottom: 10 }}>
        <h1>Catégories</h1>
        <p className="lead">
          Chaque catégorie regroupe les fournisseurs d&apos;un même maillon de votre
          infrastructure. Un incident chez l&apos;un d&apos;eux vous concerne directement.
        </p>
      </section>
      <div className="grid three">
        {categories.map((c) => (
          <Link className="card link" key={c.category} href={`/categories/${c.category}`}>
            <h3 style={{ textTransform: "capitalize" }}>{c.category.replace(/-/g, " ")}</h3>
            <div className="dim">
              {c.count} fournisseurs · {c.degraded} en incident
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
