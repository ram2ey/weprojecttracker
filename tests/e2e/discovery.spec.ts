import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import sharp from "sharp";
import {
  emptyPayload,
  emptyFinancials,
  type PublicContent,
} from "../../src/lib/content/types";
import type { ProjectMapData } from "../../src/lib/content/discovery";
config({ path: ".env.local", quiet: true });
const url = new URL(process.env.DATABASE_URL!);
url.pathname = "/wassa_test";
if (url.hostname !== "127.0.0.1" || url.port !== "55432")
  throw new Error("Isolated test database required.");
const pool = new Pool({ connectionString: url.toString() }),
  ids: string[] = [],
  people = [randomUUID(), randomUUID()];
let slug: string, photoId: string, announcementSlug: string, reportSlug: string;
test.beforeAll(async () => {
  for (const [i, id] of people.entries())
    await pool.query(
      'INSERT INTO "user" (id,name,email,email_verified) VALUES ($1,$2,$3,true)',
      [id, `Discovery test ${i}`, `discovery-${id}@example.invalid`],
    );
  for (let i = 0; i < 110; i++) {
    const id = randomUUID(),
      revision = randomUUID(),
      kind = i === 108 ? "announcement" : i === 109 ? "report" : "project",
      state = i === 105 ? "draft" : i === 106 ? "pending" : "approved",
      title = `Discovery project ${String(i + 1).padStart(3, "0")}`,
      recordSlug = `discovery-${id}`;
    ids.push(id);
    await pool.query(
      "INSERT INTO content_record (id,kind,slug,created_by) VALUES ($1,$2,$3,$4)",
      [id, kind, recordSlug, people[0]],
    );
    const attachments = [];
    if (i === 104) {
      slug = recordSlug;
      for (let n = 0; n < 2; n++) {
        const fileId = randomUUID();
        if (!n) photoId = fileId;
        const key = `${id}/${fileId}.webp`,
          thumb = `${id}/${fileId}.thumb.webp`;
        const root = resolve(".local/test-media");
        await mkdir(join(root, id), { recursive: true });
        const image = await sharp({
          create: {
            width: 160,
            height: 100,
            channels: 3,
            background: n ? "#c0a97b" : "#35724e",
          },
        })
          .webp()
          .toBuffer();
        await writeFile(join(root, key), image);
        await writeFile(join(root, thumb), image);
        await pool.query(
          "INSERT INTO media_file (id,record_id,uploaded_by,original_name,mime_type,size,storage_key,thumbnail_key) VALUES ($1,$2,$3,'site.webp','image/webp',$4,$5,$6)",
          [fileId, id, people[0], image.length, key, thumb],
        );
        attachments.push({
          id: fileId,
          caption: `Discovery photograph ${n + 1}`,
          capturedOn: "2026-10-15",
          visibility: "public",
          purpose: "evidence",
        });
      }
    }
    const p = {
      ...emptyPayload,
      title,
      description:
        "Approved public discovery fixture for browsing and map verification.",
      objectives: "Test public project discovery.",
      categoryId: "category-education",
      categoryName: "Education",
      subcategoryId: i % 2 ? "test-sub" : "",
      subcategoryName: i % 2 ? "Basic schools" : "",
      communityId: "test-community",
      communityName:
        i >= 105
          ? "Private locality"
          : i < 53
            ? "Discovery North"
            : "Discovery South",
      latitude: i >= 95 && i < 105 ? 5.3 + (i === 104 ? 0.2 : 0) : null,
      longitude: i >= 95 && i < 105 ? -1.4 : null,
      status: i < 5 ? "Planned" : "Ongoing",
      progress: i < 5 ? 0 : i % 90,
      progressExplanation: "A reviewed progress explanation.",
      source: "Reviewed test source",
      reportingOffice: "Test reporting office",
      attachments,
      tags: ["discovery-fixture"],
      milestones: [
        {
          title: "Site prepared",
          description: "The initial work is documented.",
          date: "2026-10-01",
          achieved: true,
        },
      ],
    };
    await pool.query(
      "INSERT INTO content_revision (id,record_id,number,state,base_version,author_id,contributors,payload,financials,submitted_by,submitted_at,decided_by,decided_at) VALUES ($1,$2,1,$3,0,$4,$5,$6,$7,$4,'2026-10-14',$8,$9)",
      [
        revision,
        id,
        state,
        people[0],
        JSON.stringify([people[0]]),
        JSON.stringify(p),
        JSON.stringify({
          ...emptyFinancials,
          budget: "999123456.78",
          fundingSource: "PRIVATE-PHASE3-MARKER",
        }),
        people[1],
        i < 60 ? "2026-10-15T12:00:00Z" : "2026-10-20T12:00:00Z",
      ],
    );
    if (state === "approved")
      await pool.query(
        "UPDATE content_record SET published_revision_id=$2,version=1,withdrawn_at=$3 WHERE id=$1",
        [id, revision, i === 107 ? new Date() : null],
      );
    if (i === 108) announcementSlug = recordSlug;
    if (i === 109) reportSlug = recordSlug;
  }
});
test.afterAll(async () => {
  await pool.query(
    "UPDATE content_record SET published_revision_id=NULL WHERE id=ANY($1::text[])",
    [ids],
  );
  await pool.query("DELETE FROM media_file WHERE record_id=ANY($1::text[])", [
    ids,
  ]);
  await pool.query(
    "DELETE FROM content_revision WHERE record_id=ANY($1::text[])",
    [ids],
  );
  await pool.query("DELETE FROM content_record WHERE id=ANY($1::text[])", [
    ids,
  ]);
  await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [people]);
  await pool.end();
});
test("directory combines all filters, preserves pagination and counts every approved project", async ({
  page,
  request,
}) => {
  await page.goto("/projects");
  await expect(page.locator(".project-card")).toHaveCount(24);
  await expect(
    page.getByRole("option", { name: "Private locality", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Category", { exact: true }).selectOption("Education");
  await page
    .getByLabel("Subcategory", { exact: true })
    .selectOption("Basic schools");
  await page
    .getByLabel("Community", { exact: true })
    .selectOption("Discovery North");
  await page
    .getByLabel("Project status", { exact: true })
    .selectOption("Ongoing");
  await page.getByLabel("Updated from").fill("2026-10-15");
  await page.getByLabel("Updated through").fill("2026-10-15");
  await page
    .getByLabel("Search projects", { exact: true })
    .fill("discovery-fixture");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.locator(".project-card")).toHaveCount(24);
  await page.getByLabel("Subcategory", { exact: true }).selectOption("");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByLabel("Community", { exact: true })).toHaveValue(
    "Discovery North",
  );
  await expect(page.locator(".project-card")).toHaveCount(24);
  const result = await request.get(
    "/api/public/content?kind=project&category=Education&sort=title",
  );
  expect(result.status()).toBe(200);
  const data = (await result.json()) as {
    total: number;
    items: PublicContent[];
  };
  expect(data.total).toBe(105);
  expect(data.items[0].payload.title).toBe("Discovery project 001");
  await page.goto("/");
  await expect(
    page.locator(".category-card").filter({ hasText: "Education" }),
  ).toContainText("105");
  expect(await page.content()).not.toContain("PRIVATE-PHASE3-MARKER");
});
test("map endpoint uses the same filters and omits private records and fields", async ({
  request,
}) => {
  const response = await request.get(
    "/api/public/projects/map?community=Discovery%20South&from=2026-10-20&to=2026-10-20",
  );
  expect(response.status()).toBe(200);
  const data = (await response.json()) as ProjectMapData;
  expect(data.total).toBe(45);
  expect(data.located).toBe(10);
  expect(data.geojson.features).toHaveLength(10);
  expect(JSON.stringify(data)).not.toMatch(
    /PRIVATE-PHASE3|financials|budget|fundingSource|authorId|storageKey|Private locality/,
  );
  expect(
    (
      await request.get(
        "/api/public/projects/map?from=2026-10-30&to=2026-10-01",
      )
    ).status(),
  ).toBe(400);
  expect(
    (await request.get("/api/public/content?from=2026-02-30")).status(),
  ).toBe(400);
  const old = (await (
    await request.get("/api/public/content?kind=project&to=2026-10-15")
  ).json()) as { total: number };
  expect(old.total).toBe(60);
});
test("map is opt-in, missing-key fallback preserves the list, and filters are retained", async ({
  page,
}) => {
  let configCalls = 0;
  await page.route("**/api/public/map-config", (route) => {
    configCalls++;
    return route.fulfill({ json: { configured: false } });
  });
  await page.goto("/projects?view=map&community=Discovery%20South");
  expect(configCalls).toBe(0);
  await page.getByRole("button", { name: "Load interactive map" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "not available yet" }),
  ).toBeVisible();
  await expect(
    page.getByText("10 of 52 matching projects have published coordinates.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.locator(".project-card")).toHaveCount(24);
  await page.getByRole("link", { name: "List", exact: true }).click();
  await expect(page).toHaveURL(/view=list/);
  await expect(page.getByLabel("Community", { exact: true })).toHaveValue(
    "Discovery South",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".local/phase3-directory-mobile.png",
    fullPage: true,
  });
});
test("MapLibre renders clusters and supports keyboard project selection without external tiles", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/public/map-config", (route) =>
    route.fulfill({
      json: {
        configured: true,
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#e6ebdf" },
            },
          ],
        },
      },
    }),
  );
  await page.goto("/projects?view=map&community=Discovery%20South");
  await page.getByRole("button", { name: "Load interactive map" }).click();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: /projects; zoom into this group/ })
      .first(),
  ).toBeVisible({ timeout: 20000 });
  await page
    .getByRole("button", { name: /projects; zoom into this group/ })
    .first()
    .click();
  await page.getByLabel("Find a mapped project").selectOption(slug);
  await expect(page.locator(".map-selected-record")).toContainText(
    "Discovery project 105",
  );
  await expect(
    page.getByRole("link", { name: "View approved project" }),
  ).toHaveAttribute("href", `/projects/${slug}`);
  await page.locator(".map-canvas").scrollIntoViewIfNeeded();
  await page
    .locator(".map-canvas")
    .screenshot({ path: ".local/phase3-map-desktop.png" });
  expect(errors).toEqual([]);
});
test("project metadata, gallery, sharing and publication indexes expose approved content only", async ({
  page,
  request,
}) => {
  await page.goto(`/projects/${slug}`);
  await expect(page).toHaveTitle(/Discovery project 105/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `http://localhost:3100/projects/${slug}`,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "Discovery project 105",
  );
  expect(await page.content()).not.toMatch(
    /PRIVATE-PHASE3-MARKER|999123456\.78/,
  );
  await expect(
    page.getByRole("heading", { name: "Milestones", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Enlarge photograph 1: Discovery photograph 1",
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Next photograph", exact: true })
    .click();
  await expect(page.locator("#gallery-caption")).toContainText(
    "Discovery photograph 2",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    }),
  );
  await page.getByRole("button", { name: "Share this record" }).click();
  await expect(page.getByRole("status")).toContainText(
    /Link copied|Copy the link/,
  );
  const image = await request.get(`/api/og?slug=${slug}`);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  expect((await image.body()).length).toBeGreaterThan(1000);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(slug);
  expect(sitemap).toContain(announcementSlug);
  expect(sitemap).toContain(reportSlug);
  expect(sitemap).not.toContain("classroom-block");
  await page.goto("/announcements");
  await expect(page.locator(".publication-card")).toHaveCount(1);
  await page.goto("/reports");
  await expect(page.locator(".publication-card")).toHaveCount(1);
  await expect(page.locator(".publication-card a").first()).toHaveAttribute(
    "href",
    `/information/${reportSlug}`,
  );
  const record = ids[104];
  await request.get(`/projects/${slug}`);
  expect(
    (await request.get(`/projects/${slug}`)).headers()["x-public-render-cache"],
  ).toBe("hit");
  await pool.query("UPDATE content_record SET withdrawn_at=NOW() WHERE id=$1", [
    record,
  ]);
  for (const path of [
    `/projects/${slug}`,
    `/api/og?slug=${slug}`,
    `/api/media/${photoId}`,
  ])
    expect((await request.get(path)).status(), path).toBe(404);
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(slug);
  const map = (await (
    await request.get("/api/public/projects/map")
  ).json()) as ProjectMapData;
  expect(map.geojson.features.some((f) => f.properties.slug === slug)).toBe(
    false,
  );
});
