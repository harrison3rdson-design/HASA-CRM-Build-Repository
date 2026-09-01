type AppUrlEnvironment = Readonly<Record<string, string | undefined>>;

function normalizeAppUrl(value: string): string {
  const candidate = value.includes("://") ? value : `https://${value}`;
  const url = new URL(candidate);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("The application URL must use HTTP or HTTPS.");
  }
  return url.toString().replace(/\/$/, "");
}

export function resolveAppUrl(environment: AppUrlEnvironment = process.env): string {
  const configuredUrl = environment.APP_URL ?? environment.NEXT_PUBLIC_APP_URL;
  if (configuredUrl?.trim()) return normalizeAppUrl(configuredUrl.trim());

  const vercelHost = environment.VERCEL_PROJECT_PRODUCTION_URL ?? environment.VERCEL_URL;
  if (vercelHost?.trim()) return normalizeAppUrl(vercelHost.trim());

  throw new Error("The application URL is not configured.");
}

export function hasAppUrl(environment: AppUrlEnvironment = process.env): boolean {
  try {
    resolveAppUrl(environment);
    return true;
  } catch {
    return false;
  }
}
