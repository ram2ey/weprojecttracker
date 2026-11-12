"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { blankStory } from "@/lib/news/types";
import type { newsWorkspace, storyProjects } from "@/lib/news/service";
import { canApprove, canSubmit, type Role } from "@/lib/security/policy";
import { contentRequest, errorMessage } from "@/components/content/client-api";

type Props = Awaited<ReturnType<typeof newsWorkspace>> & {
  projects: Awaited<ReturnType<typeof storyProjects>>;
  role: Role;
};
export function NewsEditor({ items, selected, projects, role }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [alertFollowers, setAlertFollowers] = useState(true);
  const [newId] = useState(() => crypto.randomUUID());
  const story = selected?.draft ?? blankStory;
  const editable = canSubmit(role) && selected?.state !== "pending";
  const reviewer = canApprove(role);
  async function send(action: string, form?: HTMLFormElement) {
    setBusy(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        action,
        id: selected?.id ?? newId,
        version: selected?.version ?? 0,
      };
      if (action === "approve") payload.notifyFollowers = alertFollowers;
      let upload: FormData | undefined;
      if (form) {
        const data = new FormData(form);
        payload.fields = Object.fromEntries(
          ["kind", "title", "summary", "detail", "caption", "project"].map(
            (key) => [key, data.get(key) ?? ""],
          ),
        );
        payload.removePhoto = data.get("removePhoto") === "on";
        const file = data.get("upload");
        if (file instanceof File && file.size) {
          if (file.size > 10 * 1024 * 1024)
            throw new Error("Choose a photo up to 10 MB.");
          upload = new FormData();
          upload.set("story", JSON.stringify(payload));
          upload.set("photo", file);
        }
      }
      const result = await contentRequest<{ id: string }>(
        "/api/staff/news",
        "POST",
        upload ?? payload,
      );
      router.replace("/admin?view=news&id=" + result.id);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const button = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    void send(button?.value ?? "save", event.currentTarget);
  }
  return (
    <>
      <h1>News &amp; Features</h1>
      <nav aria-label="News stories" className="detail-section">
        {items.map((item) => (
          <p key={item.id}>
            <Link href={"/admin?view=news&id=" + item.id}>{item.title}</Link> ·{" "}
            {item.state}
          </p>
        ))}
        {selected && canSubmit(role) && (
          <Link className="text-link" href="/admin?view=news">
            New story
          </Link>
        )}
      </nav>
      {(selected || editable) && (
        <section className="detail-section">
          <h2>{selected ? story.title : "New story"}</h2>
          {selected && (
            <p>
              {selected.state} ·{" "}
              {selected.live ? "Visible on the website" : "Unpublished"}
            </p>
          )}
          {editable ? (
            <form method="post" action="/api/staff/news" onSubmit={submit}>
              <fieldset disabled={busy} className="news-fields">
                <label>
                  Story type
                  <select name="kind" defaultValue={story.kind}>
                    <option>News</option>
                    <option>Feature</option>
                  </select>
                </label>
                <label>
                  Headline
                  <input
                    name="title"
                    maxLength={160}
                    defaultValue={story.title}
                    required
                  />
                </label>
                <label>
                  Summary
                  <textarea
                    name="summary"
                    maxLength={500}
                    defaultValue={story.summary}
                  />
                </label>
                <label>
                  Full story (optional)
                  <textarea
                    name="detail"
                    rows={5}
                    maxLength={8000}
                    defaultValue={story.detail}
                  />
                </label>
                <label>
                  Related project
                  <select
                    aria-label="Related project"
                    name="project"
                    defaultValue={story.project}
                  >
                    <option value="">None</option>
                    {projects.map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Photo (JPEG, PNG or WebP, up to 10 MB)
                  <input
                    name="upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                  />
                </label>
                {story.photo && (
                  <>
                    <Image
                      src={story.photo}
                      alt={story.caption}
                      width={280}
                      height={210}
                      unoptimized
                    />
                    <label>
                      <input name="removePhoto" type="checkbox" />
                      Remove current photo
                    </label>
                  </>
                )}
                <label>
                  Photo description
                  <input
                    name="caption"
                    maxLength={180}
                    defaultValue={story.caption}
                  />
                </label>
                <div className="action-row">
                  <button className="button button-outline" value="save">
                    Save draft
                  </button>
                  <button className="button button-primary" value="submit">
                    Submit for review
                  </button>
                </div>
              </fieldset>
            </form>
          ) : (
            <>
              <p>{story.kind}</p>
              <p>{story.summary}</p>
              <p className="preserve-lines">{story.detail}</p>
              {story.photo && (
                <figure>
                  <Image
                    src={story.photo}
                    width={480}
                    height={360}
                    alt={story.caption}
                    unoptimized
                  />
                  <figcaption>{story.caption}</figcaption>
                </figure>
              )}
              {story.project && (
                <Link href={"/projects/" + story.project}>
                  View related project
                </Link>
              )}
            </>
          )}
          <div className="action-row">
            {selected?.state === "pending" && reviewer && (
              <>
                {selected.live ? (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={alertFollowers}
                      aria-describedby="news-alert-help"
                      onChange={(e) => setAlertFollowers(e.target.checked)}
                    />
                    Send a notification about this update
                  </label>
                ) : (
                  <p className="subtle-note">
                    People with news notifications turned on are alerted
                    automatically when this story is first published.
                  </p>
                )}
                {selected.live && (
                  <p id="news-alert-help" className="subtle-note">
                    Untick for small corrections, such as spelling fixes, that
                    do not need an alert.
                  </p>
                )}
                <button
                  className="button button-primary"
                  disabled={busy}
                  onClick={() => send("approve")}
                >
                  Approve and publish
                </button>
                <button
                  className="button button-outline"
                  disabled={busy}
                  onClick={() => send("return")}
                >
                  Return for editing
                </button>
              </>
            )}
            {selected?.live && reviewer && (
              <button
                className="button button-outline"
                disabled={busy}
                onClick={() => send("withdraw")}
              >
                Withdraw from website
              </button>
            )}
          </div>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
