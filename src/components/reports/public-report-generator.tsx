"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { contentRequest, errorMessage } from "@/components/content/client-api";
import type { ReportFilters } from "@/lib/reports/data";
export function PublicReportGenerator({ filters }: { filters: ReportFilters }) {
  const [message, setMessage] = useState(""),
    [href, setHref] = useState(""),
    [busy, setBusy] = useState(false);
  async function prepare(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setHref("");
    try {
      const result = await contentRequest<{
        recordId: string;
        revisionId: string;
        message: string;
      }>("/api/staff/reports", "POST", {
        title: form.get("title"),
        reportingOffice: form.get("reportingOffice"),
        filters,
      });
      setHref(
        `/admin/content/${result.recordId}?revision=${result.revisionId}`,
      );
      setMessage(result.message);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="form-section top-space">
      <h2>Prepare a public report</h2>
      <p className="subtle-note">
        This creates a private report draft using only currently approved public
        project data. Financial fields, private feedback, draft changes, and
        internal workflow filters are excluded. Review the PDF and submit it to
        a different approver before publication.
      </p>
      <form className="form-stack top-space" onSubmit={prepare}>
        <label>
          Public report title
          <input name="title" minLength={3} maxLength={160} required />
        </label>
        <label>
          Authorised reporting office
          <input
            name="reportingOffice"
            minLength={3}
            maxLength={300}
            required
          />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Preparing report…" : "Create private public-report draft"}
        </Button>
      </form>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {href && (
        <Link href={href} className="text-link">
          Review the report draft →
        </Link>
      )}
    </section>
  );
}
