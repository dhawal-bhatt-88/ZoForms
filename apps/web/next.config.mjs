import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Security headers applied to every route. No page is meant to be embedded, so
// framing is denied everywhere, by both the old header and CSP.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained server bundle for Docker (traces workspace deps).
  output: "standalone",
  outputFileTracingRoot: join(__dirname, "../../"),
  transpilePackages: ["@formbuilder/form-schema", "@formbuilder/ui"],
  // The Markdown version of each docs page (app/docs-md). Before the file
  // routes, so `/docs/x.md` never reaches the docs page route as a slug.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/docs.md", destination: "/docs-md" },
        { source: "/docs/:path(.+)\\.md", destination: "/docs-md/:path" },
      ],
    };
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
