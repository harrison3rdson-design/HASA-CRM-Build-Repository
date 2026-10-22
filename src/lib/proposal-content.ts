export type ProposalContentMark = {
  type: "bold" | "italic" | "strike" | "code";
};

export type ProposalContentNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProposalContentNode[];
  marks?: ProposalContentMark[];
  text?: string;
};

export type ProposalContentDocument = ProposalContentNode & { type: "doc" };

const ALLOWED_BLOCK_NODES = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "horizontalRule",
]);
const ALLOWED_INLINE_NODES = new Set(["text", "hardBreak"]);
const ALLOWED_MARKS = new Set<ProposalContentMark["type"]>([
  "bold",
  "italic",
  "strike",
  "code",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeMarks(value: unknown): ProposalContentMark[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const marks = value.flatMap((mark) => {
    if (!isRecord(mark) || typeof mark.type !== "string" || !ALLOWED_MARKS.has(mark.type as ProposalContentMark["type"])) {
      return [];
    }
    return [{ type: mark.type as ProposalContentMark["type"] }];
  });
  return marks.length ? marks : undefined;
}

function sanitizeNode(value: unknown, depth = 0): ProposalContentNode | null {
  if (!isRecord(value) || typeof value.type !== "string" || depth > 12) return null;
  const type = value.type;
  if (!ALLOWED_BLOCK_NODES.has(type) && !ALLOWED_INLINE_NODES.has(type)) return null;

  if (type === "text") {
    if (typeof value.text !== "string" || value.text.length === 0) return null;
    return { type, text: value.text, marks: sanitizeMarks(value.marks) };
  }
  if (type === "hardBreak" || type === "horizontalRule") return { type };

  const content = Array.isArray(value.content)
    ? value.content.map((child) => sanitizeNode(child, depth + 1)).filter(Boolean) as ProposalContentNode[]
    : [];
  const node: ProposalContentNode = { type };
  if (content.length) node.content = content;
  if (type === "heading") {
    const rawLevel = isRecord(value.attrs) ? Number(value.attrs.level) : 3;
    node.attrs = { level: [2, 3, 4].includes(rawLevel) ? rawLevel : 3 };
  } else if (type === "orderedList") {
    const rawStart = isRecord(value.attrs) ? Number(value.attrs.start) : 1;
    node.attrs = { start: Number.isInteger(rawStart) && rawStart > 0 ? rawStart : 1 };
  }
  return node;
}

function textNodesForLines(lines: string[]): ProposalContentNode[] {
  const content: ProposalContentNode[] = [];
  lines.forEach((line, index) => {
    if (index > 0) content.push({ type: "hardBreak" });
    if (line) content.push({ type: "text", text: line });
  });
  return content;
}

export function legacyTextToProposalDocument(text: string): ProposalContentDocument {
  const normalized = String(text ?? "").replace(/\r\n?/g, "\n");
  const blocks: ProposalContentNode[] = [];
  let paragraphLines: string[] = [];
  let activeList: { type: "bulletList" | "orderedList"; items: ProposalContentNode[] } | null = null;

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    blocks.push({ type: "paragraph", content: textNodesForLines(paragraphLines) });
    paragraphLines = [];
  };
  const flushList = () => {
    if (!activeList) return;
    blocks.push({ type: activeList.type, content: activeList.items });
    activeList = null;
  };

  normalized.split("\n").forEach((line) => {
    const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
      flushParagraph();
      const type = bullet ? "bulletList" : "orderedList";
      if (activeList?.type !== type) flushList();
      activeList ??= { type, items: [] };
      activeList.items.push({
        type: "listItem",
        content: [{ type: "paragraph", content: [{ type: "text", text: (bullet ?? numbered)?.[1] ?? "" }] }],
      });
      return;
    }
    flushList();
    if (!line.trim()) {
      flushParagraph();
      return;
    }
    paragraphLines.push(line);
  });
  flushList();
  flushParagraph();

  return {
    type: "doc",
    content: blocks.length ? blocks : [{ type: "paragraph" }],
  };
}

export function normalizeProposalContent(
  value: unknown,
  fallbackText = "",
): ProposalContentDocument {
  if (isRecord(value) && value.type === "doc" && Array.isArray(value.content)) {
    const content = value.content
      .map((node) => sanitizeNode(node))
      .filter(Boolean) as ProposalContentNode[];
    if (content.length) return { type: "doc", content };
  }
  return legacyTextToProposalDocument(fallbackText);
}

export function parseProposalContentJson(
  value: FormDataEntryValue | null,
  fallbackText = "",
): ProposalContentDocument {
  if (typeof value !== "string" || !value.trim()) return legacyTextToProposalDocument(fallbackText);
  try {
    return normalizeProposalContent(JSON.parse(value), fallbackText);
  } catch {
    return legacyTextToProposalDocument(fallbackText);
  }
}

function nodePlainText(node: ProposalContentNode, listIndex?: number): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "horizontalRule") return "---";
  if (node.type === "listItem") {
    const prefix = listIndex === undefined ? "• " : `${listIndex}. `;
    return prefix + (node.content ?? []).map((child) => nodePlainText(child)).join("").trim();
  }
  if (node.type === "orderedList") {
    const start = Number(node.attrs?.start ?? 1);
    return (node.content ?? []).map((child, index) => nodePlainText(child, start + index)).join("\n");
  }
  if (node.type === "bulletList") {
    return (node.content ?? []).map((child) => nodePlainText(child)).join("\n");
  }
  return (node.content ?? []).map((child) => nodePlainText(child)).join("");
}

export function proposalContentToPlainText(document: ProposalContentDocument): string {
  return (document.content ?? [])
    .map((node) => nodePlainText(node))
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] as string);
}

function nodeHtml(node: ProposalContentNode): string {
  if (node.type === "text") {
    let value = escapeHtml(node.text ?? "");
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") value = `<strong>${value}</strong>`;
      if (mark.type === "italic") value = `<em>${value}</em>`;
      if (mark.type === "strike") value = `<s>${value}</s>`;
      if (mark.type === "code") value = `<code>${value}</code>`;
    }
    return value;
  }
  if (node.type === "hardBreak") return "<br>";
  if (node.type === "horizontalRule") return "<hr>";
  const content = (node.content ?? []).map(nodeHtml).join("");
  if (node.type === "paragraph") return `<p>${content}</p>`;
  if (node.type === "heading") return `<h${Number(node.attrs?.level ?? 3)}>${content}</h${Number(node.attrs?.level ?? 3)}>`;
  if (node.type === "bulletList") return `<ul>${content}</ul>`;
  if (node.type === "orderedList") return `<ol start="${Number(node.attrs?.start ?? 1)}">${content}</ol>`;
  if (node.type === "listItem") return `<li>${content}</li>`;
  if (node.type === "blockquote") return `<blockquote>${content}</blockquote>`;
  return content;
}

export function proposalContentToSafeHtml(
  value: unknown,
  fallbackText = "",
): string {
  const document = normalizeProposalContent(value, fallbackText);
  return (document.content ?? []).map(nodeHtml).join("");
}
