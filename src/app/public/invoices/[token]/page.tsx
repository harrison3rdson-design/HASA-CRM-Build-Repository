import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasaHorizontalLogoDataUri } from "@/lib/branding/assets";
import {
  INVOICE_STORAGE_URL_VALIDITY_SECONDS,
} from "@/lib/public/invoice-link-policy";
import {
  resolveInvoiceShareLink,
  type InvoiceLinkFailureReason,
} from "@/lib/public/invoice";
import { createSignedDocumentUrl } from "@/lib/storage/private-storage";
import "@/styles/public.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invoice | HASA Concepts",
  robots: { index: false, follow: false },
};

function messageFor(reason: InvoiceLinkFailureReason) {
  if (reason === "expired") {
    return {
      title: "This invoice link has expired",
      body: "For your security, invoice links remain active for 120 days. Please contact HASA Concepts for a fresh copy.",
    };
  }
  if (reason === "unavailable") {
    return {
      title: "This invoice is temporarily unavailable",
      body: "The link is valid, but the invoice could not be opened right now. Please try again or contact HASA Concepts for assistance.",
    };
  }
  return {
    title: "This invoice link is not valid",
    body: "The link may have been replaced or entered incorrectly. Please use the latest invoice email or contact HASA Concepts for a fresh copy.",
  };
}

function InvoiceLinkMessage({ reason }: { reason: InvoiceLinkFailureReason }) {
  const message = messageFor(reason);
  return (
    <main className="public-shell public-invoice-link-shell">
      <section className="public-document public-invoice-link-message">
        <img className="public-brand-logo" src={hasaHorizontalLogoDataUri()} alt="HASA Concepts" />
        <div>
          <p className="public-invoice-link-eyebrow">Customer Invoice</p>
          <h1>{message.title}</h1>
          <p className="public-muted">{message.body}</p>
        </div>
        <div className="public-legal-links">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </div>
      </section>
    </main>
  );
}

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolution = await resolveInvoiceShareLink(token);
  if (!resolution.ok) {
    return <InvoiceLinkMessage reason={resolution.reason} />;
  }

  let signedUrl: string;
  try {
    signedUrl = await createSignedDocumentUrl(
      resolution.storagePath,
      INVOICE_STORAGE_URL_VALIDITY_SECONDS,
    );
  } catch {
    return <InvoiceLinkMessage reason="unavailable" />;
  }

  redirect(signedUrl);
}
