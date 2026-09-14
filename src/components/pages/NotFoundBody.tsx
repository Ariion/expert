import Link from "next/link";
import { dict, href, type Locale } from "@/lib/i18n";

export function NotFoundBody({ locale }: { locale: Locale }) {
  const t = dict(locale).notFound;

  return (
    <div className="wrap">
      <section className="hero">
        <h1>{t.h1}</h1>
        <p className="lead">{t.lead}</p>
        <div className="row" style={{ marginTop: 18 }}>
          <Link className="btn" href={href(locale, "/status")}>
            {t.ctaProviders}
          </Link>
          <Link className="btn ghost" href={href(locale, "/")}>
            {t.ctaHome}
          </Link>
        </div>
      </section>
    </div>
  );
}
