"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut, signOutErrorMessage } from "./sign-out";
export function PasswordForm({ required }: { required: boolean }) {
  const router = useRouter(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("newPassword") !== f.get("confirmPassword")) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/staff/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: f.get("currentPassword"),
          newPassword: f.get("newPassword"),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      router.replace("/staff/login?changed=1");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to connect.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Change password</h1>
      <p>
        {required
          ? "Choose your own password before opening the workspace."
          : "Choose a new password for your account."}{" "}
        You will sign in again afterward.
      </p>
      <form className="form-stack" onSubmit={submit}>
        <label>
          Current password
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
          />
        </label>
        <label>
          New password
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        <label>
          Confirm new password
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        <p className="subtle-note">Use 12–128 characters.</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button disabled={busy} type="submit">
          {busy ? "Saving…" : "Change password"}
        </Button>
      </form>
      <Button
        variant="ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await signOut();
            router.replace("/staff/login");
            router.refresh();
          } catch {
            setError(signOutErrorMessage);
          } finally {
            setBusy(false);
          }
        }}
      >
        Sign out
      </Button>
    </>
  );
}
