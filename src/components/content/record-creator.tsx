"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { contentRequest, errorMessage } from "./client-api";
export function RecordCreator() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const fields = new FormData(event.currentTarget);
    try {
      const result = await contentRequest<{
        recordId: string;
        revisionId: string;
      }>("/api/staff/content", "POST", Object.fromEntries(fields));
      router.push(
        `/admin/content/${result.recordId}?revision=${result.revisionId}`,
      );
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="console-heading">
        <div>
          <span className="eyebrow">A CLEAR STARTING POINT</span>
          <h1>Start a new record.</h1>
          <p>
            Create a private draft, add the details and evidence, then send it
            for independent review.
          </p>
        </div>
      </div>
      <section className="team-panel">
        <FilePlus2 size={28} />
        <form className="form-stack top-space" onSubmit={create}>
          <label>
            Record type
            <select name="kind" aria-label="Record type">
              <option value="project">Project</option>
              <option value="announcement">Announcement</option>
              <option value="report">Public report</option>
            </select>
          </label>
          <label>
            Title
            <input
              name="title"
              minLength={3}
              maxLength={160}
              placeholder="Give this record a clear, descriptive title"
              required
            />
          </label>
          {message && (
            <p className="form-error" role="alert">
              {message}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Creating draft…" : "Create private draft"}
            <ArrowRight size={16} />
          </Button>
        </form>
      </section>
    </>
  );
}
