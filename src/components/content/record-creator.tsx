"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { contentRequest, errorMessage } from "./client-api";
export function RecordCreator() {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const r = await contentRequest<{ recordId: string; revisionId: string }>(
        "/api/staff/content",
        "POST",
        { kind: "project", title: f.get("title") },
      );
      router.push("/admin/content/" + r.recordId + "?revision=" + r.revisionId);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>New project</h1>
      <p>Drafts remain private until they are submitted and approved.</p>
      <form className="form-section form-stack" onSubmit={submit}>
        <label>
          Title
          <input name="title" minLength={3} maxLength={160} required />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          Create private draft
        </Button>
      </form>
    </>
  );
}
