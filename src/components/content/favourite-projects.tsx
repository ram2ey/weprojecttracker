"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PublicContent } from "@/lib/content/types";
import { ProjectCard } from "../project-card";
import { ProjectCollection, useSavedProjects } from "./project-preferences";

type Result = PublicContent | "unavailable" | "error";

async function loadProject(slug: string, signal: AbortSignal): Promise<Result> {
  try {
    const response = await fetch(
      "/api/public/content/" + encodeURIComponent(slug),
      { cache: "no-store", signal },
    );
    if (response.status === 404) return "unavailable";
    if (!response.ok) return "error";
    return await response.json();
  } catch {
    return "error";
  }
}

export function FavouriteProjects() {
  const snapshot = useSavedProjects();
  const [attempt, retry] = useState(0);
  const [records, setRecords] = useState<Partial<Record<string, Result>>>({});
  useEffect(() => {
    if (!snapshot) return;
    const controller = new AbortController();
    const slugs: string[] = JSON.parse(snapshot);
    async function load() {
      for (let i = 0; i < slugs.length; i += 6) {
        const batch = await Promise.all(
          slugs
            .slice(i, i + 6)
            .map(
              async (slug) =>
                [slug, await loadProject(slug, controller.signal)] as const,
            ),
        );
        if (controller.signal.aborted) return;
        setRecords((previous) => ({
          ...previous,
          ...Object.fromEntries(batch),
        }));
      }
    }
    void load();
    return () => controller.abort();
  }, [snapshot, attempt]);
  const slugs: string[] = JSON.parse(snapshot ?? "[]");
  const results = slugs.map((slug) => records[slug]);
  const loading = snapshot === null || results.includes(undefined);
  const failed = results.includes("error");
  const projects = results.filter(
    (r): r is PublicContent => !!r && typeof r === "object",
  );
  return (
    <>
      {loading && <p role="status">Loading favourites…</p>}
      {failed && (
        <div className="notice">
          <p role="alert">
            Some favourites could not load. Your saved list is still here.
          </p>
          <button
            className="button button-outline"
            type="button"
            onClick={() => retry((n) => n + 1)}
          >
            Retry loading favourites
          </button>
        </div>
      )}
      {projects.length > 0 && (
        <ProjectCollection count={projects.length}>
          {projects.map((project) => (
            <ProjectCard
              key={project.slug}
              project={project}
              resultsHref="/favourites"
            />
          ))}
        </ProjectCollection>
      )}
      {!loading && !failed && !projects.length && (
        <div className="empty-state">
          <h2>No favourites yet</h2>
          <p>Select the heart on a project to save it here.</p>
          <Link className="button button-outline" href="/">
            Browse projects
          </Link>
        </div>
      )}
    </>
  );
}
