"use client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useState, type FormEvent } from "react";
import { ShieldCheck, ArrowRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
export function SecurityForm({ enrolled }: { enrolled: boolean }) {
  const router = useRouter();
  const [enrolment, setEnrolment] = useState<{
    secret: string;
    qr: string;
  } | null>(null);
  const [recovery, setRecovery] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  async function start() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/staff/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enrol" }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.message);
      else setEnrolment(data);
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/staff/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code: fields.get("code") }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.message);
      else if (data.recoveryCodes) setRecovery(data.recoveryCodes);
      else {
        router.replace("/admin");
        router.refresh();
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (recovery.length)
    return (
      <>
        <span className="auth-icon">
          <ShieldCheck />
        </span>
        <h1>Save recovery codes</h1>
        <p className="auth-description">
          Save these recovery codes somewhere secure. Each works once if you
          lose your authenticator. They will not be shown again.
        </p>
        <div className="recovery-grid">
          {recovery.map((code) => (
            <code key={code}>{code}</code>
          ))}
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(recovery.join("\n"));
            } catch {
              setError("Copy unavailable. Save the displayed codes manually.");
            }
          }}
        >
          <Copy size={16} /> Copy recovery codes
        </Button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button
          className="full-width top-space"
          onClick={() => {
            router.replace("/admin");
            router.refresh();
          }}
        >
          I&apos;ve saved my codes <ArrowRight size={16} />
        </Button>
      </>
    );
  return (
    <>
      <span className="auth-icon">
        <ShieldCheck />
      </span>
      <h1>{enrolled ? "Verify identity" : "Set up MFA"}</h1>
      <p className="auth-description">
        {enrolled
          ? "Enter your authenticator code."
          : "Scan the QR code with your authenticator, then enter its six-digit code."}
      </p>
      {!enrolled && !enrolment && (
        <Button disabled={busy} onClick={start}>
          {busy ? "Preparing…" : "Set up authenticator"}
          <ArrowRight size={16} />
        </Button>
      )}
      {enrolment && (
        <div className="qr-panel">
          <Image
            src={enrolment.qr}
            alt="Scan this QR code with your authenticator app"
            width={200}
            height={200}
            unoptimized
          />
          <details>
            <summary>Enter a setup key instead</summary>
            <code>{enrolment.secret}</code>
          </details>
        </div>
      )}
      {(enrolled || enrolment) && (
        <form className="form-stack" onSubmit={verify}>
          <label>
            {useRecovery ? "Recovery code" : "Authenticator code"}
            <input
              key={String(useRecovery)}
              name="code"
              autoComplete="one-time-code"
              inputMode={useRecovery ? "text" : "numeric"}
              minLength={useRecovery ? 16 : 6}
              maxLength={useRecovery ? 16 : 6}
              pattern={useRecovery ? "[a-f0-9]{16}" : "[0-9]{6}"}
              placeholder={useRecovery ? "Your saved recovery code" : "000000"}
              required
            />
          </label>
          <Button disabled={busy} type="submit">
            {busy ? "Checking…" : "Verify and continue"}
            <ArrowRight size={16} />
          </Button>
          {enrolled && (
            <button
              className="text-link"
              type="button"
              onClick={() => setUseRecovery(!useRecovery)}
            >
              {useRecovery
                ? "Use an authenticator code"
                : "Use a recovery code instead"}
            </button>
          )}
        </form>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </>
  );
}
