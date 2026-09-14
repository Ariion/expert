"use client";

import { useEffect, useState } from "react";

/** Rafraîchi toutes les 10 s : assez pour sentir le « en direct », sans matraquer la base. */
export function AdminLive({ initial }: { initial: number }) {
  const [live, setLive] = useState(initial);

  useEffect(() => {
    const tick = () =>
      fetch("/api/admin/live")
        .then((r) => r.json())
        .then((d: { live?: number }) => {
          if (typeof d.live === "number") setLive(d.live);
        })
        .catch(() => {});
    const timer = setInterval(tick, 10_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="card">
      <div className="dim" style={{ fontSize: 12.5, marginBottom: 6 }}>EN CE MOMENT</div>
      <div className="flex" style={{ gap: 10 }}>
        <span className="dot" style={{ background: "var(--ok)", width: 10, height: 10 }} />
        <strong style={{ fontSize: 30, lineHeight: 1 }}>{live}</strong>
        <span className="dim">visiteur{live !== 1 ? "s" : ""} actif{live !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}
