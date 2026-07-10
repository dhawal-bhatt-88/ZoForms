import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Baseline security headers applied to every route. (No global X-Frame-Options
// so the public form runtime /r/* stays embeddable; the authenticated app is
// frame-protected separately below.)
const SAFE_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained server bundle for Docker (traces workspace deps).
  output: "standalone",
  outputFileTracingRoot: join(__dirname, "../../"),
  transpilePackages: ["@formbuilder/form-schema", "@formbuilder/ui"],
  async headers() {
    return [
      { source: "/:path*", headers: SAFE_HEADERS },
      // Anti-clickjacking for the authenticated app (embeds are on /r/* only).
      { source: "/app/:path*", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] },
    ];
  },
};

export default nextConfig;
