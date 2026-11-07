"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/auth/sign-in/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: String(f.get("username")).trim().toLowerCase(),
          password: f.get("password"),
        }),
      });
      if (!r.ok)
        throw new Error(
          r.status === 429
            ? "Too many attempts. Please wait and try again."
            : "Unable to sign in. Check your username and password.",
        );
      router.replace("/admin");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to connect.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Staff sign-in</h1>
      <p>Sign in to maintain the project register.</p>
      {!configured && (
        <p role="status">Staff access is awaiting configuration.</p>
      )}
      <form className="form-stack" onSubmit={submit}>
        <label>
          Username
          <input
            name="username"
            autoComplete="username"
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
            maxLength={128}
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
        </Button>
      </form>
      <p className="subtle-note">
        Contact your operator for access or a password reset.
      </p>
    </>
  );
}
