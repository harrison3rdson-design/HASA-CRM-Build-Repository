"use client";

import Image from "next/image";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AuthenticatorFactor = {
  id: string;
  friendlyName: string;
  status: string;
};

type EnrollmentDetails = {
  factorId: string;
  friendlyName: string;
  qrCode: string;
  secret: string;
};

type Notice = {
  kind: "success" | "error";
  text: string;
};

export function MfaManagement() {
  const router = useRouter();
  const [factors, setFactors] = useState<AuthenticatorFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [friendlyName, setFriendlyName] = useState("Backup authenticator");
  const [enrollment, setEnrollment] = useState<EnrollmentDetails | null>(null);
  const [enrollmentCode, setEnrollmentCode] = useState("");
  const [removalTargetId, setRemovalTargetId] = useState<string | null>(null);
  const [verificationFactorId, setVerificationFactorId] = useState("");
  const [removalCode, setRemovalCode] = useState("");

  const verifiedFactors = factors.filter((factor) => factor.status === "verified");
  const pendingFactors = factors.filter((factor) => factor.status !== "verified");
  const removalTarget = factors.find((factor) => factor.id === removalTargetId) ?? null;
  const verificationOptions = verifiedFactors.filter(
    (factor) => factor.id !== removalTargetId
  );

  async function loadFactors(showError = true) {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) {
      if (showError) {
        setNotice({
          kind: "error",
          text: "Authenticator devices could not be loaded. Refresh the page and try again.",
        });
      }
      setLoading(false);
      return;
    }

    setFactors(
      data.all
        .filter((factor) => factor.factor_type === "totp")
        .map((factor) => ({
          id: factor.id,
          friendlyName: factor.friendly_name || "Authenticator device",
          status: factor.status,
        }))
    );
    setLoading(false);
  }

  useEffect(() => {
    void loadFactors();
  }, []);

  async function startEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = friendlyName.trim();

    if (normalizedName.length < 2 || normalizedName.length > 64) {
      setNotice({
        kind: "error",
        text: "Enter a device name between 2 and 64 characters.",
      });
      return;
    }
    if (enrollment || pendingFactors.length > 0) {
      setNotice({
        kind: "error",
        text: "Finish or clear the pending authenticator setup before adding another device.",
      });
      return;
    }

    setBusy(true);
    setNotice(null);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: normalizedName,
      issuer: "HASA Concepts",
    });

    if (error) {
      setNotice({
        kind: "error",
        text: "The backup authenticator setup could not be started. Please try again.",
      });
      setBusy(false);
      return;
    }

    setEnrollment({
      factorId: data.id,
      friendlyName: normalizedName,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
    setEnrollmentCode("");
    setBusy(false);
    await loadFactors(false);
  }

  async function verifyEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = enrollmentCode.replace(/\s/g, "");
    if (!enrollment || !/^\d{6}$/.test(code)) {
      setNotice({
        kind: "error",
        text: "Enter the six-digit code shown on the new authenticator.",
      });
      return;
    }

    setBusy(true);
    setNotice(null);
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: enrollment.factorId });
    if (challengeError) {
      setNotice({
        kind: "error",
        text: "A verification challenge could not be created. Please try again.",
      });
      setBusy(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrollment.factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      setNotice({
        kind: "error",
        text: "That code was not accepted. Wait for a new code and try again.",
      });
      setBusy(false);
      return;
    }

    const enrolledName = enrollment.friendlyName;
    setEnrollment(null);
    setEnrollmentCode("");
    setFriendlyName("Backup authenticator");
    await loadFactors(false);
    setNotice({
      kind: "success",
      text: `${enrolledName} is enrolled and ready for account recovery.`,
    });
    setBusy(false);
    router.refresh();
  }

  async function clearPendingFactor(factorId: string) {
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      setNotice({
        kind: "error",
        text: "The pending authenticator setup could not be cleared.",
      });
      setBusy(false);
      return;
    }

    if (enrollment?.factorId === factorId) {
      setEnrollment(null);
      setEnrollmentCode("");
    }
    await loadFactors(false);
    setNotice({ kind: "success", text: "The pending authenticator setup was cleared." });
    setBusy(false);
  }

  function beginRemoval(factorId: string) {
    const alternative = verifiedFactors.find((factor) => factor.id !== factorId);
    if (!alternative) {
      setNotice({
        kind: "error",
        text: "Add and verify a backup authenticator before removing this device.",
      });
      return;
    }

    setNotice(null);
    setRemovalTargetId(factorId);
    setVerificationFactorId(alternative.id);
    setRemovalCode("");
  }

  async function removeFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = removalCode.replace(/\s/g, "");
    if (
      !removalTargetId ||
      !verificationFactorId ||
      verificationFactorId === removalTargetId ||
      !/^\d{6}$/.test(code)
    ) {
      setNotice({
        kind: "error",
        text: "Enter a current six-digit code from a different authenticator.",
      });
      return;
    }

    setBusy(true);
    setNotice(null);
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: verificationFactorId });
    if (challengeError) {
      setNotice({
        kind: "error",
        text: "The backup authenticator could not be verified. Please try again.",
      });
      setBusy(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: verificationFactorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      setNotice({
        kind: "error",
        text: "That backup-authenticator code was not accepted.",
      });
      setBusy(false);
      return;
    }

    const targetName = removalTarget?.friendlyName ?? "Authenticator device";
    const { error: removeError } = await supabase.auth.mfa.unenroll({
      factorId: removalTargetId,
    });
    if (removeError) {
      setNotice({
        kind: "error",
        text: "The authenticator could not be removed. Your devices were not changed.",
      });
      setBusy(false);
      return;
    }

    setRemovalTargetId(null);
    setVerificationFactorId("");
    setRemovalCode("");
    await loadFactors(false);
    setNotice({
      kind: "success",
      text: `${targetName} was removed. Your verified backup remains active.`,
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mfa-management">
      <p className="settings-section-intro">
        Keep at least two authenticator devices on separate devices. Supabase does not
        issue recovery codes, so the backup authenticator is your account-recovery method.
      </p>

      {notice ? (
        <p
          className={`form-message ${notice.kind}`}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          {notice.text}
        </p>
      ) : null}

      <section className="mfa-management-card" aria-labelledby="registered-authenticators">
        <div className="mfa-section-heading">
          <div>
            <h3 id="registered-authenticators">Registered Authenticators</h3>
            <p>Only verified devices can be used to sign in.</p>
          </div>
          <span className="pill">{verifiedFactors.length} verified</span>
        </div>

        {loading ? <p className="muted">Loading authenticator devices…</p> : null}
        {!loading && factors.length === 0 ? (
          <p className="form-message error" role="alert">
            No authenticator device is registered. Sign out and complete MFA setup again.
          </p>
        ) : null}

        <div className="mfa-factor-list">
          {factors.map((factor) => (
            <div className="mfa-factor-row" key={factor.id}>
              <div>
                <strong>{factor.friendlyName}</strong>
                <p>{factor.status === "verified" ? "Verified authenticator" : "Pending setup"}</p>
              </div>
              {factor.status === "verified" ? (
                <button
                  className="secondary-button danger-button"
                  type="button"
                  disabled={busy || verifiedFactors.length <= 1}
                  onClick={() => beginRemoval(factor.id)}
                  title={
                    verifiedFactors.length <= 1
                      ? "Add a verified backup before removing this device."
                      : undefined
                  }
                >
                  Remove
                </button>
              ) : (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy}
                  onClick={() => void clearPendingFactor(factor.id)}
                >
                  Clear Pending Setup
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {removalTarget ? (
        <section className="mfa-management-card mfa-removal-card" aria-labelledby="remove-authenticator">
          <h3 id="remove-authenticator">Remove {removalTarget.friendlyName}</h3>
          <p>
            Prove that a different authenticator works before this device is removed.
          </p>
          <form className="mfa-management-form" onSubmit={removeFactor}>
            <label>
              Verify using
              <select
                value={verificationFactorId}
                onChange={(event) => setVerificationFactorId(event.target.value)}
                disabled={busy}
                required
              >
                {verificationOptions.map((factor) => (
                  <option key={factor.id} value={factor.id}>
                    {factor.friendlyName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Six-digit code from that authenticator
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={removalCode}
                onChange={(event) => setRemovalCode(event.target.value)}
                disabled={busy}
                required
                autoFocus
              />
            </label>
            <div className="button-row">
              <button className="secondary-button danger-button" type="submit" disabled={busy}>
                {busy ? "Verifying…" : "Verify Backup and Remove"}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={busy}
                onClick={() => {
                  setRemovalTargetId(null);
                  setRemovalCode("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="mfa-management-card" aria-labelledby="add-backup-authenticator">
        <h3 id="add-backup-authenticator">Add a Backup Authenticator</h3>
        <p>
          Use a separate phone, tablet, password manager, or authenticator application.
          Keep it independent from your primary device.
        </p>

        {!enrollment ? (
          <form className="mfa-management-form mfa-enrollment-start" onSubmit={startEnrollment}>
            <label>
              Device name
              <input
                value={friendlyName}
                onChange={(event) => setFriendlyName(event.target.value)}
                maxLength={64}
                disabled={busy || pendingFactors.length > 0}
                required
              />
            </label>
            <button
              className="primary-button"
              type="submit"
              disabled={busy || loading || pendingFactors.length > 0}
            >
              {busy ? "Starting…" : "Add Backup Authenticator"}
            </button>
          </form>
        ) : (
          <div className="mfa-enrollment">
            <ol className="mfa-instructions">
              <li>Open the authenticator on the backup device.</li>
              <li>Scan this QR code or enter the setup key manually.</li>
              <li>Enter the new six-digit code to finish enrollment.</li>
            </ol>
            <div className="mfa-qr">
              <Image
                src={enrollment.qrCode}
                alt={`QR code for ${enrollment.friendlyName}`}
                width={220}
                height={220}
                unoptimized
              />
            </div>
            <details className="mfa-secret">
              <summary>Cannot scan the QR code?</summary>
              <p>Enter this setup key manually:</p>
              <code>{enrollment.secret}</code>
            </details>
            <form className="mfa-management-form" onSubmit={verifyEnrollment}>
              <label>
                Six-digit code from the new authenticator
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={enrollmentCode}
                  onChange={(event) => setEnrollmentCode(event.target.value)}
                  disabled={busy}
                  required
                  autoFocus
                />
              </label>
              <div className="button-row">
                <button className="primary-button" type="submit" disabled={busy}>
                  {busy ? "Verifying…" : "Verify Backup Authenticator"}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy}
                  onClick={() => void clearPendingFactor(enrollment.factorId)}
                >
                  Cancel Setup
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      <p className="mfa-recovery-note">
        If one device is lost, sign in with the remaining authenticator and remove the lost
        device here. If every authenticator is lost, an authorized Owner Administrator must
        verify your identity and reset MFA through Supabase Authentication.
      </p>

      <style jsx>{`
        .mfa-management{display:grid;gap:16px}
        .settings-section-intro{margin:0;color:var(--muted);line-height:1.5}
        .mfa-management>.form-message{padding:12px 14px;border-radius:8px;background:#f8fafc}
        .mfa-management>.form-message.success{background:#e9f7ef}
        .mfa-management>.form-message.error{background:#fff1f1}
        .mfa-management-card{border:1px solid var(--border);border-radius:10px;padding:16px;background:#fafbfc}
        .mfa-management-card h3{margin:0 0 6px;font-size:15px}
        .mfa-management-card>p,.mfa-section-heading p,.mfa-factor-row p{margin:0;color:var(--muted);font-size:13px;line-height:1.45}
        .mfa-section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
        .mfa-factor-list{display:grid}
        .mfa-factor-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0;border-top:1px solid var(--border)}
        .mfa-factor-row:first-child{border-top:0}
        .mfa-factor-row strong{display:block;font-size:14px;margin-bottom:3px}
        .mfa-management-form{display:grid;gap:14px;margin-top:16px;max-width:620px}
        .mfa-management-form label{display:grid;gap:6px;font-size:13px;font-weight:600}
        .mfa-management-form input,.mfa-management-form select{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:#fff;font:inherit}
        .mfa-enrollment-start{grid-template-columns:minmax(220px,1fr) auto;align-items:end}
        .mfa-removal-card{border-color:#fecaca;background:#fffafa}
        .mfa-enrollment{margin-top:16px}
        .mfa-recovery-note{margin:0;padding:12px 14px;border-left:3px solid #64748b;background:var(--soft);color:var(--muted);font-size:13px;line-height:1.5}
        @media(max-width:700px){
          .mfa-enrollment-start{grid-template-columns:1fr}
          .mfa-factor-row{align-items:flex-start;flex-direction:column}
        }
      `}</style>
    </div>
  );
}
