import type { NextConfig } from "next";

// Allow next/image to optimise product photos stored in an S3-compatible bucket.
const s3 = process.env.S3_PUBLIC_URL ? new URL(process.env.S3_PUBLIC_URL) : null;

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: s3
      ? [{ protocol: s3.protocol === "http:" ? "http" : "https", hostname: s3.hostname, pathname: `${s3.pathname.replace(/\/$/, "")}/**` }]
      : [],
  },
  experimental: {
    // Product photo uploads go through Server Actions.
    serverActions: { bodySizeLimit: "12mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
