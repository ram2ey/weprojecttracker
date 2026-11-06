"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Taxonomy } from "@/lib/content/types";
import { contentRequest, errorMessage } from "./client-api";
import { Button } from "@/components/ui/button";
export function TaxonomyManager({ terms }: { terms: Taxonomy[] }) {
  const router = useRouter(),
    [edit, setEdit] = useState<Taxonomy | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    setBusy(true);
    try {
      await contentRequest("/api/staff/taxonomy", "POST", {
        id: edit?.id,
        name: f.get("name"),
        active: f.get("active") === "on",
      });
      setEdit(null);
      form.reset();
      setMessage(
        "Community saved. Existing publications retain their approved names.",
      );
      router.refresh();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Communities</h1>
      <p>Project categories are fixed. Add or retire communities here.</p>
      <form
        key={edit?.id ?? "new"}
        className="form-section form-stack"
        onSubmit={submit}
      >
        <h2>{edit ? "Edit community" : "Add community"}</h2>
        <label>
          Name
          <input
            name="name"
            defaultValue={edit?.name ?? ""}
            minLength={2}
            maxLength={120}
            required
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="active"
            defaultChecked={edit?.active ?? true}
          />
          Available for new submissions
        </label>
        <div className="action-row">
          <Button disabled={busy} type="submit">
            Save community
          </Button>
          {edit && (
            <Button type="button" variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
          )}
        </div>
      </form>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <ul className="community-list">
        {terms
          .filter((t) => t.kind === "community")
          .map((t) => (
            <li key={t.id}>
              <span>
                {t.name}
                {!t.active ? " · Retired" : ""}
              </span>
              <Button variant="outline" onClick={() => setEdit(t)}>
                Edit {t.name}
              </Button>
            </li>
          ))}
      </ul>
    </>
  );
}
