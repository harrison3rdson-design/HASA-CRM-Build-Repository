import { existsSync } from "node:fs";
import { sha256Hex } from "@/lib/security/tokens";
import { resolveChromiumPackUrl } from "@/lib/documents/chromium-pack-url";

export { resolveChromiumPackUrl } from "@/lib/documents/chromium-pack-url";

let cachedServerlessExecutablePath: string | null = null;
let serverlessExecutablePromise: Promise<string> | null = null;

async function serverlessExecutablePath() {
  if (cachedServerlessExecutablePath) return cachedServerlessExecutablePath;

  if (!serverlessExecutablePromise) {
    serverlessExecutablePromise = import("@sparticuz/chromium-min")
      .then(({ default: chromium }) => chromium.executablePath(resolveChromiumPackUrl()))
      .then((path) => {
        cachedServerlessExecutablePath = path;
        return path;
      })
      .catch((error) => {
        serverlessExecutablePromise = null;
        throw error;
      });
  }

  return serverlessExecutablePromise;
}

function localExecutablePath() {
  const configured = process.env.CHROME_EXECUTABLE_PATH;
  if (configured && existsSync(configured)) return configured;

  const candidates = process.platform === "win32"
    ? [
        `${process.env.PROGRAMFILES ?? "C:\\Program Files"}\\Microsoft\\Edge\\Application\\msedge.exe`,
        `${process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)"}\\Microsoft\\Edge\\Application\\msedge.exe`,
        `${process.env.PROGRAMFILES ?? "C:\\Program Files"}\\Google\\Chrome\\Application\\chrome.exe`,
        `${process.env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`,
      ]
    : process.platform === "darwin"
      ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
      : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];

  const detected = candidates.find((path) => path && existsSync(path));
  if (detected) return detected;

  throw new Error("A local Chrome or Edge executable could not be found.");
}

export async function renderHtmlToPdf(html: string) {
  const isVercel = process.env.VERCEL === "1";
  const puppeteer = await import("puppeteer-core");
  const executablePath = isVercel
    ? await serverlessExecutablePath()
    : localExecutablePath();
  const args = isVercel
    ? (await import("@sparticuz/chromium-min")).default.args
    : [];
  const browser = await puppeteer.launch({ executablePath, args, headless: true });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const bytes = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
    });

    return {
      bytes: Buffer.from(bytes),
      sha256: sha256Hex(bytes),
      contentType: "application/pdf" as const,
    };
  } finally {
    await browser.close();
  }
}
