import { createElement, type ReactNode } from "react";
import {
  normalizeProposalContent,
  type ProposalContentFallbackMode,
  type ProposalContentNode,
} from "@/lib/proposal-content";

function renderNode(node: ProposalContentNode, key: string): ReactNode {
  if (node.type === "text") {
    let content: ReactNode = node.text ?? "";
    for (const [index, mark] of (node.marks ?? []).entries()) {
      const markKey = `${key}-mark-${index}`;
      if (mark.type === "bold") content = <strong key={markKey}>{content}</strong>;
      if (mark.type === "italic") content = <em key={markKey}>{content}</em>;
      if (mark.type === "strike") content = <s key={markKey}>{content}</s>;
      if (mark.type === "code") content = <code key={markKey}>{content}</code>;
    }
    return content;
  }
  if (node.type === "hardBreak") return <br key={key} />;
  if (node.type === "horizontalRule") return <hr key={key} />;

  const children = (node.content ?? []).map((child, index) => renderNode(child, `${key}-${index}`));
  if (node.type === "paragraph") return <p key={key}>{children}</p>;
  if (node.type === "heading") {
    const level = Number(node.attrs?.level ?? 3) as 2 | 3 | 4;
    return createElement(`h${level}`, { key }, children);
  }
  if (node.type === "bulletList") return <ul key={key}>{children}</ul>;
  if (node.type === "orderedList") return <ol key={key} start={Number(node.attrs?.start ?? 1)}>{children}</ol>;
  if (node.type === "listItem") return <li key={key}>{children}</li>;
  if (node.type === "blockquote") return <blockquote key={key}>{children}</blockquote>;
  return null;
}

export function ProposalRichContent({
  contentJson,
  fallbackText,
  fallbackMode = "standard",
}: {
  contentJson?: unknown;
  fallbackText: string;
  fallbackMode?: ProposalContentFallbackMode;
}) {
  const document = normalizeProposalContent(contentJson, fallbackText, fallbackMode);
  return (
    <div className="proposal-rich-content">
      {(document.content ?? []).map((node, index) => renderNode(node, `proposal-content-${index}`))}
    </div>
  );
}
