import type { Metadata } from "next";
import Link from "next/link";
import "@/styles/legal.css";

export const metadata: Metadata = {
  title: "Terms and Conditions | HASA Concepts",
  description: "Terms and conditions for HASA Concepts, LLC customer communications and online services.",
};

export default function TermsPage() {
  return (
    <main className="legal-shell">
      <header className="legal-header">
        <Link className="legal-brand" href="/terms" aria-label="HASA Concepts terms and conditions">
          <strong>HASA</strong>
          <span>CONCEPTS</span>
        </Link>
        <nav className="legal-nav" aria-label="Legal pages">
          <Link href="/privacy">Privacy</Link>
          <Link aria-current="page" href="/terms">Terms</Link>
        </nav>
      </header>

      <article className="legal-document">
        <div className="legal-title">
          <p className="legal-eyebrow">HASA Concepts, LLC</p>
          <h1>Terms and Conditions</h1>
          <p>Effective September 1, 2026</p>
        </div>

        <section>
          <h2>Acceptance of these terms</h2>
          <p>
            These Terms and Conditions govern your use of online pages, document links, and communications
            provided by HASA Concepts, LLC ("HASA Concepts," "we," "us," or "our"). By accessing or using
            these services, you agree to these terms. A specific proposal, agreement, authorization, or
            invoice may contain additional terms that control if they conflict with these general terms.
          </p>
        </section>

        <section>
          <h2>Customer document services</h2>
          <p>
            We may provide secure links that allow an intended recipient to review, accept, or sign a
            proposal, additional-service authorization, invoice, or related document. You must not share a
            private document link with anyone who is not authorized to view or act on the document. Contact
            us promptly if you believe a link has been disclosed or used without authorization.
          </p>
        </section>

        <section>
          <h2>Electronic records and acceptance</h2>
          <p>
            When you submit an acceptance, authorization, or signature electronically, you agree that the
            electronic record may be used to evidence your action to the same extent permitted for a paper
            record. You represent that the information you submit is accurate and that you are authorized to
            act for the person or organization identified in the document.
          </p>
        </section>

        <section id="sms-terms">
          <h2>SMS terms</h2>
          <p>
            The HASA Concepts Customer Communications program sends transactional messages concerning
            proposals, project documents, authorizations, invoices, and related customer-service matters.
            Recipients opt in by giving consent directly to HASA Concepts, including verbal consent during a
            business conversation. We do not use this program for third-party marketing.
          </p>
          <ul>
            <li>Message frequency varies based on proposal and project activity.</li>
            <li>Message and data rates may apply.</li>
            <li>Reply <strong>STOP</strong> to opt out at any time.</li>
            <li>Reply <strong>HELP</strong> for help, or contact us using the information in your business correspondence.</li>
            <li>Consent to receive text messages is not a condition of purchasing goods or services.</li>
            <li>Wireless carriers are not liable for delayed or undelivered messages.</li>
          </ul>
          <p>
            After you opt out, we may send one confirmation message. We may still contact you through email,
            phone, or another appropriate method regarding requested services. See our <Link href="/privacy">Privacy Policy</Link>
            {" "}for information about how mobile information is handled.
          </p>
        </section>

        <section>
          <h2>Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Access a document or account you are not authorized to use.</li>
            <li>Misrepresent your identity, authority, or relationship to another person or organization.</li>
            <li>Interfere with, test, or circumvent security or access controls.</li>
            <li>Use the services for unlawful, fraudulent, harmful, or abusive activity.</li>
          </ul>
        </section>

        <section>
          <h2>Availability and third-party services</h2>
          <p>
            We may use third-party providers to host data, deliver communications, or support other service
            functions. Online services may occasionally be unavailable because of maintenance, security
            events, network conditions, or circumstances outside our reasonable control.
          </p>
        </section>

        <section>
          <h2>Disclaimers</h2>
          <p>
            Online tools and communications are provided on an "as available" basis. To the extent permitted
            by law, we do not guarantee uninterrupted access or that every electronic communication will be
            delivered without delay. The professional services we provide are governed by the applicable
            proposal, agreement, and law.
          </p>
        </section>

        <section>
          <h2>Changes to these terms</h2>
          <p>
            We may update these terms from time to time. The effective date above identifies the latest
            version. Continued use after an update means you accept the revised terms to the extent permitted
            by law.
          </p>
        </section>

        <section>
          <h2>Contact us</h2>
          <p>
            For questions about these terms or our communications, contact HASA Concepts, LLC using the
            business email address or phone number shown on your proposal, invoice, or other correspondence
            from us.
          </p>
        </section>
      </article>

      <footer className="legal-footer">
        <span>© 2026 HASA Concepts, LLC</span>
        <Link href="/privacy">Privacy Policy</Link>
      </footer>
    </main>
  );
}
