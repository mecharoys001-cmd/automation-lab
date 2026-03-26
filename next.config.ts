import type { NextConfig } from "next";

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
            value:
              process.env.NODE_ENV === "production"
                ? "https://tools.artsnwct.org"
                : "http://localhost:3000",
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
