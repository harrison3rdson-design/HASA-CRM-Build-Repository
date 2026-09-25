const isVercelProduction = process.env.VERCEL === "1"
  && process.env.VERCEL_ENV === "production";

if (!isVercelProduction) {
  process.exit(0);
}

const required = ["CRON_SECRET"];
const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
}

console.log("Production environment preflight passed.");
