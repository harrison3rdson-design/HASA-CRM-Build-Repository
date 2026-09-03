import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages locate runtime files dynamically and must not be bundled.
  serverExternalPackages: ["@sparticuz/chromium-min", "puppeteer-core"],
  // PDF renderers read these files from disk, so include them in every server trace.
  outputFileTracingIncludes: {
    "/*": ["./public/branding/**/*"],
  },
};

export default nextConfig;
