import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("management navigation link styles", () => {
  const activeStyles = read("src/styles/app.css");
  const mirroredStyles = read("styles/app.css");
  const navigationalSelector = ".content a:not(.primary-button):not(.secondary-button)";

  it("gives navigational text the established table-link treatment", () => {
    expect(activeStyles).toContain(`.table-link,${navigationalSelector}`);
    expect(activeStyles).toContain("color:#174f7a");
    expect(activeStyles).toContain("font-weight:700");
    expect(activeStyles).toContain("text-decoration:underline");
    expect(activeStyles).toContain("text-underline-offset:3px");
  });

  it("keeps button links visually distinct", () => {
    expect(navigationalSelector).toContain(":not(.primary-button)");
    expect(navigationalSelector).toContain(":not(.secondary-button)");
  });

  it("includes hover and keyboard-focus affordances", () => {
    expect(activeStyles).toContain(`${navigationalSelector}:hover`);
    expect(activeStyles).toContain(`${navigationalSelector}:focus-visible`);
  });

  it("keeps the mirrored stylesheet aligned", () => {
    expect(mirroredStyles).toContain(`.table-link,${navigationalSelector}`);
    expect(mirroredStyles).toContain(`${navigationalSelector}:focus-visible`);
  });
});
