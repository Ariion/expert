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
 * Le tableau des services, filtrable à la frappe et par catégorie.
 *
 * Seul composant client du site public, et pour une raison précise : sur cent
 * soixante services, la recherche est ce qui transforme une longue liste en
 * réponse immédiate. Tout est rendu côté serveur — les filtres ne font que
 * masquer des lignes déjà présentes, donc la page reste entièrement lisible
 * sans JavaScript, y compris par un moteur de recherche.
 */
export function ServiceBoard({
  rows,
  searchLabel,
  searchPlaceholder,
  noMatch,
  noMatchHint,
  catAll,
}: {
  rows: BoardRow[];
  searchLabel: string;
  searchPlaceholder: string;
  noMatch: string;
  noMatchHint: string;
  /** Étiquette du filtre « toutes catégories ». */
  catAll: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  // Comptées sur l'ensemble des lignes, jamais sur le résultat déjà filtré :
  // sinon choisir une catégorie ferait disparaître les autres pastilles au
  // lieu de les laisser cliquables pour en changer.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (category && r.category !== category) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.slug.includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    });
  }, [rows, query, category]);

  return (
    <>
      {categories.length > 1 && (
        <div className="cat-nav" role="group">
          <button type="button" className={category === null ? "on" : ""} onClick={() => setCategory(null)}>
            {catAll} <span className="cat-count">{rows.length}</span>
          </button>
          {categories.map(([cat, count]) => (
            <button
              type="button"
              key={cat}
              className={category === cat ? "on" : ""}
              onClick={() => setCategory(category === cat ? null : cat)}
            >
              {cat} <span className="cat-count">{count}</span>
            </button>
          ))}
        </div>
      )}

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
              {r.tone === "ok" ? (
                <span className="status-quiet ok">
                  <i className="dot" />
                  {r.status}
                </span>
              ) : (
                <span className={`badge ${r.tone}`}>
                  <i className="dot" />
                  {r.status}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
