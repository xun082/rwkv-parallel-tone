import type { NextConfig } from "next";

const ONE_YEAR_SECONDS = 31_536_000;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.100"],
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: ONE_YEAR_SECONDS,
    qualities: [60, 70, 75],
    localPatterns: [
      {
        pathname: "/transparent/**",
        search: "",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/transparent/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
