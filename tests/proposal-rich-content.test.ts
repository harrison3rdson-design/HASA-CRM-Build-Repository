import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  legacyTextToProposalDocument,
  normalizeProposalContent,
  proposalContentToPlainText,
  proposalContentToSafeHtml,
} from "../src/lib/proposal-content";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("proposal rich content", () => {
  it("preserves legacy paragraphs and promotes list-like lines into semantic lists", () => {
    const document = legacyTextToProposalDocument("Overview line\n\n- First item\n- Second item");

    expect(document.content?.map((node) => node.type)).toEqual(["paragraph", "bulletList"]);
    expect(proposalContentToPlainText(document)).toContain("• First item\n• Second item");
    expect(proposalContentToSafeHtml(document)).toContain("<ul><li><p>First item</p></li>");
  });

  it("keeps supported formatting and strips unsupported nodes and markup", () => {
    const document = normalizeProposalContent({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Safe <text>", marks: [{ type: "bold" }] }] },
        { type: "image", attrs: { src: "javascript:alert(1)" } },
      ],
    });

    expect(proposalContentToSafeHtml(document)).toBe("<p><strong>Safe &lt;text&gt;</strong></p>");
  });

  it("uses one formatted source in the editor, customer view, accepted PDF, and acceptance snapshot", () => {
    expect(read("src/components/forms/proposal-scope-fields.tsx")).toContain("ProposalContentEditor");
    expect(read("src/components/public/proposal-document.tsx")).toContain("ProposalRichContent");
    expect(read("src/lib/documents/executed-html.ts")).toContain("proposalContentToSafeHtml");
    expect(read("supabase/migrations/20261022153912_proposal_section_rich_content.sql"))
      .toContain("'contentJson', section.content_json");
  });
});
