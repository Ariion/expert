import Link from "next/link";
import { getCategories } from "@/lib/queries";
import { categoryLabel, dict, href, type Locale } from "@/lib/i18n";

export async function CategoriesIndex({ locale }: { locale: Locale }) {
  const t = dict(locale);
  const categories = await getCategories().catch(() => []);

  return (
    <div className="wrap">
      <section className="hero" style={{ paddingBottom: 10 }}>
        <h1>{t.categories.h1}</h1>
        <p className="lead">{t.categories.lead}</p>
      </section>
      <div className="grid three">
        {categories.map((c) => (
          <Link className="card link" key={c.category} href={href(locale, `/categories/${c.category}`)}>
            <h3>{categoryLabel(c.category, locale)}</h3>
            <div className="dim">{t.home.categoryCount(c.count, c.degraded)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
