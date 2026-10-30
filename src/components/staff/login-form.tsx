"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
export function LoginForm({
  configured,
  googleEnabled,
}: {
  configured: boolean;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          password: data.get("password"),
          callbackURL: "/staff/security",
        }),
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? "Too many attempts. Please wait before trying again."
            : "Unable to sign in. Check your details or contact the operator.",
        );
        return;
      }
      router.replace("/staff/security");
      router.refresh();
    } catch {
      setError("Unable to connect. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "google",
          callbackURL: "/staff/security",
          errorCallbackURL: "/staff/login",
        }),
      });
      const data = await response.json();
      if (response.ok && data.url) window.location.assign(data.url);
      else setError("Google sign-in is unavailable for this account.");
    } catch {
      setError("Unable to start Google sign-in.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <span className="auth-icon">
        <LockKeyhole size={23} />
      </span>
      <h1>Staff sign-in</h1>
      {!configured && (
        <p className="notice" role="status">
          Staff sign-in is not configured yet.
        </p>
      )}
      <form onSubmit={signIn} className="form-stack">
        <label>
          Email address
          <input
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            required
            disabled={!configured || busy}
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={!configured || busy}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Button type="submit" disabled={!configured || busy}>
          {busy ? "Signing in…" : "Sign in"}
          <ArrowRight size={17} />
        </Button>
      </form>
      {googleEnabled && (
        <>
          <div className="form-divider">or</div>
          <Button
            variant="outline"
            className="full-width"
            disabled={busy || !configured}
            onClick={google}
          >
            <span className="google-g" aria-hidden="true">
              G
            </span>{" "}
            Continue with Google
          </Button>
        </>
      )}
      <p className="auth-help">
        Need access or a password reset? Contact your operator.
      </p>
    </>
  );
}
