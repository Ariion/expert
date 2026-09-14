"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";

const PING_MS = 20_000;

/**
 * Balise de mesure, sans cookie ni script tiers.
 *
 * Une vue est enregistrée au montage ; tant que l'onglet reste visible, un
 * battement toutes les 20 s prolonge la durée mesurée de cette visite. Le
 * dernier battement part par `sendBeacon` à la fermeture de l'onglet, seul
 * mécanisme fiable à ce moment précis : une requête `fetch` ordinaire serait
 * coupée avant d'atteindre le serveur.
 */
export function Analytics({ locale }: { locale: Locale }) {
  const pathname = usePathname();

  useEffect(() => {
    let id: string | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const ping = () => {
      if (!id) return;
      const payload = JSON.stringify({ id });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/track/ping", payload);
      else fetch("/api/track/ping", { method: "POST", body: payload, keepalive: true }).catch(() => {});
    };

    fetch("/api/track/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: pathname, locale, referrer: document.referrer || undefined }),
    })
      .then((r) => r.json())
      .then((data: { id?: string | null }) => {
        if (cancelled || !data.id) return;
        id = data.id;
        timer = setInterval(() => {
          if (document.visibilityState === "visible") ping();
        }, PING_MS);
      })
      .catch(() => {});

    const onHide = () => {
      if (document.visibilityState === "hidden") ping();
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      ping();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
