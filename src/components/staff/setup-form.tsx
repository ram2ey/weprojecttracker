"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { KeyRound, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
export function SetupForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const fields = new FormData(event.currentTarget);
    if (fields.get("password") !== fields.get("confirm")) {
      setError("The passwords do not match.");
      return;
    }
    const token = window.location.hash.slice(1);
    if (!token) {
      setError("Open the complete setup link provided by your operator.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/staff/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: fields.get("password") }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.message);
      else {
        history.replaceState(null, "", "/staff/setup");
        setDone(true);
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <span className="auth-icon">
        <KeyRound />
      </span>
      <span className="eyebrow">YOUR SECURE WORKSPACE</span>
      <h1>{done ? "You’re ready to sign in." : "Set your password."}</h1>
      <p className="auth-description">
        {done
          ? "Your password has been saved. Sign in, then complete the authenticator security check."
          : "Use a unique password with at least 12 characters. This operator-issued link works once and expires automatically."}
      </p>
      {done ? (
        <Button asChild>
          <Link href="/staff/login">
            Continue to sign-in <ArrowRight size={16} />
          </Link>
        </Button>
      ) : (
        <form className="form-stack" onSubmit={submit}>
          <label>
            New password
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              name="confirm"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button disabled={busy} type="submit">
            {busy ? "Saving…" : "Save password"}
            <ArrowRight size={16} />
          </Button>
        </form>
      )}
    </>
  );
}
