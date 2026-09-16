import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Les pages programmatiques sont rendues statiquement puis revalidées en
  // arrière-plan (ISR, voir `revalidate` dans chaque page) : le trafic
  // n'attend jamais la base, et les incidents frais arrivent sans redéploiement.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
  async redirects() {
    const rules: Awaited<ReturnType<NonNullable<NextConfig["redirects"]>>> = [
      { source: "/services/:slug", destination: "/status/:slug", permanent: true },
    ];

    /**
     * Ancien sous-domaine Vercel → domaine propre, en 301.
     *
     * Lu directement dans l'environnement plutôt qu'importé : ce fichier est
     * évalué avant l'application, et une erreur de résolution de module ici
     * empêche tout build.
     *
     * La règle ne s'ajoute QUE si APP_URL désigne déjà un domaine propre.
     * Tant qu'elle vaut encore le sous-domaine Vercel, la règle renverrait le
     * site vers lui-même — boucle infinie, site entièrement inaccessible.
     * Elle s'active donc d'elle-même au moment exact où le domaine est en
     * service, sans qu'il y ait de fenêtre pendant laquelle les deux se
     * contredisent.
     *
     * `/api/` est exclu : les tâches planifiées externes appellent ces
     * adresses, et un planificateur qui ne suit pas les redirections
     * arrêterait silencieusement la collecte.
     */
    const canonical = (process.env.APP_URL ?? "").trim().replace(/\/+$/, "");
    const isCustomDomain = /^https?:\/\/[^\s/]+$/.test(canonical) && !canonical.includes(".vercel.app");
    if (isCustomDomain) {
      rules.push({
        source: "/:path((?!api/).*)",
        has: [{ type: "host", value: "upstreamstatus.vercel.app" }],
        destination: `${canonical}/:path*`,
        permanent: true,
      });
    }

    return rules;
  },
};

export default config;
