"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Taxonomy } from "@/lib/content/types";
import { contentRequest, errorMessage } from "./client-api";
export function TaxonomyManager({ terms }: { terms: Taxonomy[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<Taxonomy | null>(null);
  const [kind, setKind] = useState<Taxonomy["kind"]>("community");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const form = event.currentTarget;
    setBusy(true);
    setMessage("");
    try {
      await contentRequest("/api/staff/taxonomy", "POST", {
        id: edit?.id,
        kind,
        name: fields.get("name"),
        parentId: kind === "subcategory" ? fields.get("parentId") : null,
        active: fields.get("active") === "on",
      });
      setEdit(null);
      form.reset();
      setMessage(
        "Saved. Existing published revisions retain their approved names.",
      );
      router.refresh();
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
          <h1>Categories & communities</h1>
          <p>
            Manage approved choices for new records. Retire old terms without
            rewriting publication history.
          </p>
        </div>
      </div>
      <section className="team-panel">
        <h2>{edit ? "Edit an approved term" : "Add an approved term"}</h2>
        <form key={edit?.id ?? "new"} className="form-stack" onSubmit={save}>
          <div className="form-columns">
            <label>
              Term type
              <select
                aria-label="Term type"
                value={kind}
                disabled={Boolean(edit)}
                onChange={(event) =>
                  setKind(event.target.value as Taxonomy["kind"])
                }
              >
                <option value="community">Community</option>
                <option value="category">Category</option>
                <option value="subcategory">Subcategory</option>
              </select>
            </label>
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
            {kind === "subcategory" && (
              <label>
                Parent category
                <select
                  name="parentId"
                  aria-label="Parent category"
                  defaultValue={edit?.parentId ?? ""}
                  required
                >
                  <option value="">Choose a category</option>
                  {terms
                    .filter((t) => t.kind === "category" && t.active)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>
          <label className="checkbox-label">
            <input
              name="active"
              type="checkbox"
              defaultChecked={edit?.active ?? true}
            />
            Available for new submissions
          </label>
          <div className="action-row">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save term"}
            </Button>
            {edit && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEdit(null);
                  setKind("community");
                }}
              >
                Cancel editing
              </Button>
            )}
          </div>
        </form>
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
      </section>
      <section className="table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((term) => (
                <tr key={term.id}>
                  <td>
                    {term.name}
                    {term.parentId && (
                      <small>
                        {terms.find((t) => t.id === term.parentId)?.name}
                      </small>
                    )}
                  </td>
                  <td>{term.kind}</td>
                  <td>
                    <Badge tone={term.active ? "green" : "neutral"}>
                      {term.active ? "Active" : "Retired"}
                    </Badge>
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEdit(term);
                        setKind(term.kind);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
