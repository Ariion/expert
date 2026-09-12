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
    return [{ source: "/services/:slug", destination: "/status/:slug", permanent: true }];
  },
};

export default config;
