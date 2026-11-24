"use client";

type PublicDocumentActionsProps = {
  documentName: string;
};

export function PublicDocumentActions({ documentName }: PublicDocumentActionsProps) {
  return (
    <aside className="public-document-actions" aria-label={`${documentName} download and print options`}>
      <div className="public-document-actions-copy">
        <strong>Keep a copy</strong>
        <span>Use your device&apos;s print menu to print this {documentName} or save it as a PDF.</span>
      </div>
      <button
        className="public-document-action-button"
        type="button"
        onClick={() => window.print()}
      >
        Print / Save PDF
      </button>
    </aside>
  );
}
