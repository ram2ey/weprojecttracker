"use client";
import { useState, type FormEvent } from "react";
import { Copy, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
export function TeamForm({ preview }: { preview: boolean }) {
  const [result, setResult] = useState<{
    url: string;
    expiresAt: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setMessage("");
    if (preview) {
      setMessage(
        "Design preview only. Sign in as the operator to manage real staff.",
      );
      return;
    }
    setBusy(true);
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/staff/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(fields)),
      });
      const data = await response.json();
      if (!response.ok) setMessage(data.message);
      else setResult(data);
    } catch {
      setMessage("Unable to connect. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="team-panel">
      <h2>Generate a secure staff link</h2>
      <p>
        Invite an officer or approver, or reset an existing account&apos;s
        password. Recovery preserves MFA and does not change the existing role.
      </p>
      <form className="form-stack" onSubmit={submit}>
        <div className="form-columns">
          <label>
            Full name
            <input name="name" minLength={2} maxLength={100} required />
          </label>
          <label>
            Staff email
            <input name="email" type="email" required />
          </label>
          <label>
            Role for a new account
            <select name="role">
              <option value="officer">Project officer</option>
              <option value="approver">Approver</option>
            </select>
          </label>
          <label>
            Link purpose
            <select name="kind">
              <option value="setup">New account setup · 24 hours</option>
              <option value="reset">Password recovery · 1 hour</option>
            </select>
          </label>
        </div>
        <Button type="submit" disabled={busy}>
          <LinkIcon size={16} />{" "}
          {busy ? "Generating…" : "Generate one-use link"}
        </Button>
      </form>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {result && (
        <div className="link-result">
          <strong>
            Share this privately. It is shown only for this operation.
          </strong>
          <code>{result.url}</code>
          <small>Expires: {new Date(result.expiresAt).toLocaleString()}</small>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(result.url);
                setMessage(
                  "Link copied. Share it through your own trusted channel.",
                );
              } catch {
                setMessage(
                  "Copy unavailable. Select and copy the link manually.",
                );
              }
            }}
          >
            <Copy size={15} />
            Copy link
          </Button>
        </div>
      )}
    </section>
  );
}
