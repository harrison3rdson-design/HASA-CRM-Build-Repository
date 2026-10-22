"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  normalizeProposalContent,
  proposalContentToPlainText,
  type ProposalContentDocument,
} from "@/lib/proposal-content";

type ProposalContentEditorProps = {
  initialContent?: unknown;
  fallbackText: string;
  onChange: (content: ProposalContentDocument, plainText: string) => void;
};

function ToolbarButton({
  label,
  title,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "rich-text-toolbar-button is-active" : "rich-text-toolbar-button"}
      aria-label={title}
      aria-pressed={active}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function ProposalContentEditor({
  initialContent,
  fallbackText,
  onChange,
}: ProposalContentEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
    ],
    content: normalizeProposalContent(initialContent, fallbackText),
    immediatelyRender: true,
    editorProps: {
      attributes: {
        class: "proposal-content-editor-surface",
        "aria-label": "Proposal section content",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const content = normalizeProposalContent(currentEditor.getJSON(), currentEditor.getText());
      onChange(content, proposalContentToPlainText(content));
    },
  });

  if (!editor) {
    return <div className="proposal-content-editor is-loading" aria-label="Loading content editor" />;
  }

  const chain = () => editor.chain().focus();

  return (
    <div className="proposal-content-editor">
      <div className="rich-text-toolbar" role="toolbar" aria-label="Content formatting">
        <ToolbarButton
          label="Text"
          title="Body text"
          active={editor.isActive("paragraph")}
          onClick={() => chain().setParagraph().run()}
        />
        <ToolbarButton
          label="Heading"
          title="Section heading"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => chain().toggleHeading({ level: 3 }).run()}
        />
        <span className="rich-text-toolbar-divider" aria-hidden="true" />
        <ToolbarButton
          label="B"
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() => chain().toggleBold().run()}
        />
        <ToolbarButton
          label="I"
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => chain().toggleItalic().run()}
        />
        <span className="rich-text-toolbar-divider" aria-hidden="true" />
        <ToolbarButton
          label="• List"
          title="Bulleted list"
          active={editor.isActive("bulletList")}
          onClick={() => chain().toggleBulletList().run()}
        />
        <ToolbarButton
          label="1. List"
          title="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => chain().toggleOrderedList().run()}
        />
        <ToolbarButton
          label="←"
          title="Decrease list indent"
          disabled={!editor.can().chain().focus().liftListItem("listItem").run()}
          onClick={() => chain().liftListItem("listItem").run()}
        />
        <ToolbarButton
          label="→"
          title="Increase list indent"
          disabled={!editor.can().chain().focus().sinkListItem("listItem").run()}
          onClick={() => chain().sinkListItem("listItem").run()}
        />
        <span className="rich-text-toolbar-spacer" />
        <ToolbarButton
          label="Clear"
          title="Clear formatting"
          onClick={() => chain().unsetAllMarks().clearNodes().run()}
        />
        <ToolbarButton
          label="↶"
          title="Undo"
          disabled={!editor.can().chain().focus().undo().run()}
          onClick={() => chain().undo().run()}
        />
        <ToolbarButton
          label="↷"
          title="Redo"
          disabled={!editor.can().chain().focus().redo().run()}
          onClick={() => chain().redo().run()}
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
