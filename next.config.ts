import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages locate runtime files dynamically and must not be bundled.
  serverExternalPackages: ["@sparticuz/chromium-min", "puppeteer-core"],
};

export default nextConfig;
