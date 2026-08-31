import fs from "node:fs";
import path from "node:path";

function assetDataUri(filename: string, mime: string) {
  const full = path.join(process.cwd(), "public", "branding", filename);
  const bytes = fs.readFileSync(full);
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

export function hasaHorizontalLogoDataUri() {
  return assetDataUri("hasa-logo-horizontal.jpeg", "image/jpeg");
}

export function hasaSquareLogoDataUri() {
  return assetDataUri("hasa-logo-square.jpeg", "image/jpeg");
}
