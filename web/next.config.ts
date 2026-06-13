import type { NextConfig } from "next";

// `NEXT_EXPORT=1 npm run build` produces a fully static site in web/out,
// which the Modal ASGI endpoint (server/app.py) serves alongside /api.
const exporting = process.env.NEXT_EXPORT === "1";

const nextConfig: NextConfig = exporting
  ? { output: "export", images: { unoptimized: true }, trailingSlash: true }
  : {};

export default nextConfig;
