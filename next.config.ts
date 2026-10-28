import type { NextConfig } from "next";

// Allow next/image to optimise product photos stored in an S3-compatible bucket.
const s3 = process.env.S3_PUBLIC_URL ? new URL(process.env.S3_PUBLIC_URL) : null;

// CSP without nonces: nonces would force every page to render dynamically. Everything the
// site loads is same-origin; 'unsafe-inline' covers Next's own inline bootstrap scripts.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${s3 ? ` ${s3.origin}` : ""}`,
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
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
};

export default nextConfig;
