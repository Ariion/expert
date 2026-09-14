"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface BoardRow {
  slug: string;
  name: string;
  category: string;
  href: string;
  logo: string;
  status: string;
  tone: string;
}

/**
 * Le tableau des services, filtrable à la frappe.
 *
 * Seul composant client du site public, et pour une raison précise : sur cent
 * vingt services, la recherche est ce qui transforme une longue liste en
 * réponse immédiate. Tout est rendu côté serveur — le filtre ne fait que
 * masquer des lignes déjà présentes, donc la page reste entièrement lisible
 * sans JavaScript, y compris par un moteur de recherche.
 */
export function ServiceBoard({
  rows,
  searchLabel,
  searchPlaceholder,
  noMatch,
  noMatchHint,
}: {
  rows: BoardRow[];
  searchLabel: string;
  searchPlaceholder: string;
  noMatch: string;
  noMatchHint: string;
}) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.slug.includes(q) ||
        r.category.toLowerCase().includes(q),
    );
  }, [rows, query]);

  return (
    <>
      <div className="board-search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
          autoComplete="off"
        />
      </div>

      {visible.length === 0 ? (
        <div className="notice">
          <strong>{noMatch}</strong>
          <br />
          {noMatchHint}
        </div>
      ) : (
        <div className="board">
          {visible.map((r) => (
            <Link className="board-row" key={r.slug} href={r.href}>
              <img
                className="logo-img"
                src={r.logo}
                alt=""
                width={18}
                height={18}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
              />
              <span className="board-name">
                {r.name}
                <span className="dim board-cat">{r.category}</span>
              </span>
              <span className={`badge ${r.tone}`}>
                <i className="dot" />
                {r.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
