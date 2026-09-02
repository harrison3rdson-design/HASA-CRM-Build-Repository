type ChromiumEnvironment = Readonly<Record<string, string | undefined>>;

export function resolveChromiumPackUrl(
  environment: ChromiumEnvironment = process.env
) {
  if (environment.CHROMIUM_PACK_URL) return environment.CHROMIUM_PACK_URL;

  const host = environment.VERCEL_URL ?? environment.VERCEL_PROJECT_PRODUCTION_URL;
  if (host) return `https://${host}/chromium-pack.tar`;

  if (environment.NEXT_PUBLIC_APP_URL) {
    return `${environment.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/chromium-pack.tar`;
  }

  throw new Error("The Chromium package URL is not configured.");
}
