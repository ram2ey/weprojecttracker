"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { contentRequest, errorMessage } from "@/components/content/client-api";

export function ContactForm() {
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  const attempt = useRef({ data: "", id: "" });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget,
      data = Object.fromEntries(new FormData(form)),
      signature = JSON.stringify(data);
    if (attempt.current.data !== signature)
      attempt.current = { data: signature, id: crypto.randomUUID() };
    setBusy(true);
    setStatus("");
    try {
      await contentRequest("/api/contact", "POST", {
        ...data,
        id: attempt.current.id,
      });
      form.reset();
      attempt.current = { data: "", id: "" };
      setStatus("Your enquiry was accepted for email delivery.");
    } catch (e) {
      setStatus(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form method="post" action="/api/contact" onSubmit={submit}>
      <fieldset disabled={busy} aria-label="Email enquiry">
        <div className="enquiry-pair">
          <label>
            Name
            <input name="name" required maxLength={120} autoComplete="name" />
          </label>
          <label>
            Email
            <input
              name="email"
              required
              maxLength={254}
              type="email"
              autoComplete="email"
            />
          </label>
        </div>
        <label>
          Subject
          <input name="subject" required maxLength={160} />
        </label>
        <label>
          Message
          <textarea name="message" required maxLength={4000} rows={4} />
        </label>
        <p className="subtle-note">
          Resend delivers your enquiry to the constituency office. Please leave
          out sensitive personal information.{" "}
          <Link href="/privacy">Privacy &amp; Cookies</Link>
        </p>
        <button className="button button-primary" type="submit">
          {busy ? "Sending…" : "Send message"}
        </button>
      </fieldset>
      <p role="status">{status}</p>
    </form>
  );
}
