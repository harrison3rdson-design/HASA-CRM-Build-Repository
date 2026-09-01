import type { Metadata } from "next";
import Link from "next/link";
import "@/styles/legal.css";

export const metadata: Metadata = {
  title: "Privacy Policy | HASA Concepts",
  description: "Privacy policy for HASA Concepts, LLC customer communications and management services.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="legal-shell">
      <header className="legal-header">
        <Link className="legal-brand" href="/privacy" aria-label="HASA Concepts privacy policy">
          <strong>HASA</strong>
          <span>CONCEPTS</span>
        </Link>
        <nav className="legal-nav" aria-label="Legal pages">
          <Link aria-current="page" href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </header>

      <article className="legal-document">
        <div className="legal-title">
          <p className="legal-eyebrow">HASA Concepts, LLC</p>
          <h1>Privacy Policy</h1>
          <p>Effective September 1, 2026</p>
        </div>

        <section>
          <h2>Overview</h2>
          <p>
            HASA Concepts, LLC ("HASA Concepts," "we," "us," or "our") respects your privacy. This
            policy explains how we collect, use, disclose, and protect information when we provide
            professional services, manage client and project records, deliver proposals and other
            documents, and communicate with clients by email or text message.
          </p>
        </section>

        <section>
          <h2>Information we collect</h2>
          <p>Depending on your relationship with us, we may collect:</p>
          <ul>
            <li>Names, job titles, company names, mailing addresses, email addresses, and phone numbers.</li>
            <li>Project, proposal, contract, invoice, payment, expense, and other business records.</li>
            <li>Information provided when a proposal or authorization is reviewed, accepted, or signed.</li>
            <li>Communications you send to us and records of communications we send to you.</li>
            <li>Basic technical and security information needed to operate and protect our systems.</li>
          </ul>
        </section>

        <section>
          <h2>How we use information</h2>
          <p>We use information to:</p>
          <ul>
            <li>Prepare, deliver, revise, and administer proposals, projects, invoices, and related services.</li>
            <li>Communicate with clients and their authorized contacts.</li>
            <li>Maintain business, accounting, security, and compliance records.</li>
            <li>Protect our clients, systems, and legal rights and prevent misuse or fraud.</li>
            <li>Comply with applicable laws and respond to lawful requests.</li>
          </ul>
        </section>

        <section id="sms-privacy">
          <h2>Mobile information and text messaging</h2>
          <p>
            We use text messaging only for transactional customer communications, such as delivering a
            proposal or other requested project document and providing related status information. We send
            these messages only after the recipient has consented to receive them.
          </p>
          <p>
            We do not sell, rent, or share mobile phone numbers or SMS opt-in and consent information with
            third parties or affiliates for their marketing or promotional purposes. We may provide this
            information to communications service providers that process messages solely on our behalf and
            may disclose it when required by law.
          </p>
          <p>
            Message frequency varies based on proposal and project activity. Message and data rates may
            apply. Reply <strong>STOP</strong> to opt out of text messages or <strong>HELP</strong> for help.
            Consent to receive text messages is not a condition of purchasing goods or services.
          </p>
        </section>

        <section>
          <h2>When information may be disclosed</h2>
          <p>
            We may disclose information to service providers that support hosting, data storage, document
            delivery, communications, accounting, security, and other business operations. These providers
            are permitted to use information only to perform services for us. We may also disclose
            information to comply with law, protect rights or safety, or as part of a business transaction.
          </p>
        </section>

        <section>
          <h2>Data retention and security</h2>
          <p>
            We retain information for as long as reasonably necessary to provide services, maintain business
            and legal records, resolve disputes, and enforce agreements. We use reasonable administrative,
            technical, and organizational safeguards, but no storage or transmission method can be
            guaranteed to be completely secure.
          </p>
        </section>

        <section>
          <h2>Your choices</h2>
          <p>
            You may ask us to update inaccurate contact information or stop non-required communications.
            You may opt out of text messages at any time by replying STOP. An opt-out does not prevent us
            from contacting you by another method when necessary to provide requested services or meet legal
            obligations.
          </p>
        </section>

        <section>
          <h2>Children's privacy</h2>
          <p>
            Our services are intended for businesses and their authorized representatives and are not
            directed to children under 13. We do not knowingly collect personal information from children
            under 13.
          </p>
        </section>

        <section>
          <h2>Policy updates</h2>
          <p>
            We may update this policy from time to time. The effective date above identifies the latest
            version. Material changes will be posted on this page.
          </p>
        </section>

        <section>
          <h2>Contact us</h2>
          <p>
            For privacy questions or requests, contact HASA Concepts, LLC using the business email address
            or phone number shown on your proposal, invoice, or other correspondence from us.
          </p>
        </section>
      </article>

      <footer className="legal-footer">
        <span>© 2026 HASA Concepts, LLC</span>
        <Link href="/terms">Terms and Conditions</Link>
      </footer>
    </main>
  );
}
