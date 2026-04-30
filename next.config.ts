import type { NextConfig } from "next";

// Security headers applied to every route. Tuned for what this app actually
// needs to load: Supabase (REST + storage + realtime websocket), Vercel
// Analytics, Anthropic only via our own /api/generate route, plus the
// inline scripts/styles Next + the app emit.
//
// 'unsafe-eval' is added to script-src in dev only — React's dev runtime
// reconstructs cross-environment stack traces via eval(); production builds
// never call eval().
const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(isDev ? ["'unsafe-eval'"] : []),
  "https://va.vercel-scripts.com",
].join(" ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // 1 year HSTS, no preload yet — enable preload only after committing to
  // HTTPS-only across all subdomains and submitting to the preload list.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next emits some inline bootstrap; Vercel Analytics loads from va.vercel-scripts.com
      `script-src ${scriptSrc}`,
      // Tailwind + many inline `style={...}` props in this app
      "style-src 'self' 'unsafe-inline'",
      // Photos are base64 data URLs in the editor; public photos served from Supabase Storage
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
      "font-src 'self' data:",
      // Supabase REST + auth + storage over HTTPS, realtime over WSS; Vercel Analytics ingest
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel-insights.com https://va.vercel-scripts.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
