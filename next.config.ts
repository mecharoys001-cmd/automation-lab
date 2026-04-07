import type { NextConfig } from "next";

function getCorsOrigin(): string {
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }
  // On Vercel preview deployments, use the deployment URL
  if (process.env.VERCEL_URL && process.env.VERCEL_ENV === "preview") {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "https://tools.artsnwct.org";
}

const nextConfig: NextConfig = {
  // Enable experimental optimizations
  experimental: {
    optimizePackageImports: ['lucide-react'],

  },

  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: getCorsOrigin(),
          },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
      // Security headers (X-Frame-Options, CSP, X-Content-Type-Options) are
      // set dynamically in middleware.ts with per-request CSP nonces.
    ];
  },
};

export default nextConfig;
