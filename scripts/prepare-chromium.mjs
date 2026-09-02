import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// Vercel's function bundle cannot contain a normal desktop Chromium install.
// During a Vercel build, package the serverless Chromium assets as a static file
// that @sparticuz/chromium-min can download into /tmp at runtime.
if (process.env.VERCEL === "1") {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const projectRoot = dirname(scriptDirectory);
  const chromiumEntry = fileURLToPath(import.meta.resolve("@sparticuz/chromium"));
  let chromiumRoot = dirname(chromiumEntry);

  while (
    chromiumRoot !== dirname(chromiumRoot)
    && !existsSync(join(chromiumRoot, "bin"))
  ) {
    chromiumRoot = dirname(chromiumRoot);
  }

  const chromiumBin = join(chromiumRoot, "bin");
  const publicDirectory = join(projectRoot, "public");
  const outputPath = join(publicDirectory, "chromium-pack.tar");

  if (!existsSync(chromiumBin)) {
    throw new Error(`Chromium build assets were not found at ${chromiumBin}.`);
  }

  mkdirSync(publicDirectory, { recursive: true });
  const result = spawnSync(
    "tar",
    ["-cf", outputPath, "-C", chromiumBin, "."],
    { cwd: projectRoot, stdio: "inherit" }
  );

  if (result.status !== 0) {
    throw new Error(`Chromium archive creation failed with status ${result.status}.`);
  }
}
