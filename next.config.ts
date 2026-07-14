import type { NextConfig } from "next";

const ONE_YEAR_SECONDS = 31_536_000;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.100"],
  // 敏感词表是运行时读取的源文件，需显式纳入部署产物追踪，否则 serverless
  // 打包可能不包含它。（本地 next dev / next start 从项目根读取则无此问题。）
  outputFileTracingIncludes: {
    "/api/generate": ["./data/filter.txt"],
    "/api/screen": ["./data/filter.txt"],
  },
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
