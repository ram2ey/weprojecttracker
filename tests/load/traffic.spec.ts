import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { cpus, totalmem } from "node:os";
import { emptyPayload, emptyFinancials } from "../../src/lib/content/types";
config({ path: ".env.local", quiet: true });
const url = new URL(process.env.DATABASE_URL!);
url.pathname = "/wassa_test";
if (url.hostname !== "127.0.0.1" || url.port !== "55432")
  throw new Error(
    "Load tests are restricted to the isolated local test database",
  );
const pool = new Pool({ connectionString: url.toString() }),
  origin = "http://localhost:3100",
  actor = randomUUID(),
  ids: string[] = [],
  slugs: string[] = [];
test.beforeAll(async () => {
  await pool.query(
    "INSERT INTO \"user\" (id,name,email,email_verified) VALUES ($1,'Load test author',$2,true)",
    [actor, `load-${actor}@example.invalid`],
  );
  const rows = [];
  for (let i = 0; i < 1100; i++) {
    const id = randomUUID(),
      slug = `load-${id}`;
    ids.push(id);
    slugs.push(slug);
    const state = i < 1000 ? "approved" : i < 1050 ? "draft" : "pending";
    const progress = i % 3 === 0 ? 100 : i % 3 === 1 ? 45 : 0;
    rows.push({
      id,
      slug,
      revision: randomUUID(),
      state,
      payload: {
        ...emptyPayload,
        title: `Community project ${String(i + 1).padStart(4, "0")}`,
        description:
          "Reviewed community project information with a recorded source and authorised reporting office. ".repeat(
            6,
          ),
        objectives:
          "Improve the availability and quality of the local public service.",
        categoryId: i % 2 ? "category-education" : "category-health",
        categoryName: i % 2 ? "Education" : "Health",
        communityName: `Load community ${(i % 20) + 1}`,
        status:
          progress === 100 ? "Completed" : progress ? "Ongoing" : "Planned",
        progress,
        progressExplanation:
          "Progress recorded against documented site observations.",
        latitude: i % 4 ? 5.1 + (i % 50) * 0.001 : null,
        longitude: i % 4 ? -1.5 + (i % 40) * 0.001 : null,
        actualCompletionDate: progress === 100 ? "2026-10-01" : "",
        completionSummary:
          progress === 100
            ? "The completed service was reviewed and accepted."
            : "",
        source: "Approved field observations",
        reportingOffice: "Constituency reporting office",
      },
    });
  }
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query(
      "INSERT INTO content_record (id,kind,slug,created_by) SELECT x.id,'project',x.slug,$2 FROM jsonb_to_recordset($1::jsonb) AS x(id text,slug text)",
      [JSON.stringify(rows), actor],
    );
    await db.query(
      "INSERT INTO content_revision (id,record_id,number,state,base_version,author_id,contributors,payload,financials,decided_at) SELECT x.revision,x.id,1,x.state::revision_state,0,$2,jsonb_build_array($2::text),x.payload,$3,CASE WHEN x.state='approved' THEN NOW()-INTERVAL '1 day' ELSE NULL END FROM jsonb_to_recordset($1::jsonb) AS x(id text,revision text,state text,payload jsonb)",
      [
        JSON.stringify(rows),
        actor,
        JSON.stringify({
          ...emptyFinancials,
          budget: "987654321.12",
          internalNotes: "LOAD-PRIVATE-FINANCIAL-MARKER",
        }),
      ],
    );
    await db.query(
      "UPDATE content_record r SET published_revision_id=v.id FROM content_revision v WHERE r.id=v.record_id AND r.id=ANY($1::text[]) AND v.state='approved'",
      [ids],
    );
    await db.query("ANALYZE content_record");
    await db.query("ANALYZE content_revision");
    await db.query("COMMIT");
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
});
test.afterAll(async () => {
  await pool.query(
    "UPDATE content_record SET published_revision_id=NULL WHERE id=ANY($1::text[])",
    [ids],
  );
  await pool.query(
    "DELETE FROM content_revision WHERE record_id=ANY($1::text[])",
    [ids],
  );
  await pool.query("DELETE FROM content_record WHERE id=ANY($1::text[])", [
    ids,
  ]);
  await pool.query('DELETE FROM "user" WHERE id=$1', [actor]);
  await pool.end();
});
test("1,000 published projects support 100 active local visitors", async () => {
  const samples: { path: string; ms: number; status: number }[] = [],
    failures: string[] = [];
  const percentile = (values: number[], fraction: number) =>
    values.slice().sort((a, b) => a - b)[
      Math.max(0, Math.ceil(values.length * fraction) - 1)
    ] || 0;
  const paths = [
    "/",
    "/projects",
    "/api/public/content?kind=project&limit=24",
    "/projects?status=Ongoing&category=Education",
    "/api/public/projects/map?status=Ongoing",
    "/projects?page=4",
    "/api/public/content?kind=project&q=community&sort=title",
    `/projects/${slugs[42]}`,
    `/projects/${slugs[807]}`,
    "/api/public/updates",
  ];
  for (const path of paths) {
    const response = await fetch(origin + path);
    expect(response.status).toBe(200);
    await response.arrayBuffer();
  }
  const inventory = (await (
    await fetch(origin + "/api/public/content?kind=project&limit=1")
  ).json()) as { total: number };
  expect(inventory.total).toBe(1000);
  const start = performance.now(),
    duration = 30000;
  await Promise.all(
    Array.from({ length: 100 }, async (_, visitor) => {
      await new Promise((r) => setTimeout(r, Math.floor(visitor / 10) * 250));
      let round = 0;
      while (performance.now() - start < duration) {
        const path = paths[(visitor + round) % paths.length],
          at = performance.now();
        let status = 0;
        try {
          const response = await fetch(origin + path, {
            signal: AbortSignal.timeout(10000),
          });
          status = response.status;
          const body = await response.text();
          if (body.includes("LOAD-PRIVATE-FINANCIAL-MARKER"))
            failures.push("Private marker in public response");
          if (!response.ok) failures.push(`${path}: HTTP ${response.status}`);
        } catch {
          failures.push(`${path}: request failed`);
        }
        samples.push({ path, ms: performance.now() - at, status });
        round++;
        await new Promise((r) => setTimeout(r, 400 + (visitor % 7) * 100));
      }
    }),
  );
  const report = {
    measuredAt: new Date().toISOString(),
    environment: "local standalone server; not target-host acceptance",
    node: process.version,
    logicalCPUs: cpus().length,
    memoryGiB: Math.round(totalmem() / 1024 ** 3),
    publishedProjects: 1000,
    privateProjects: 100,
    virtualVisitors: 100,
    durationSeconds: Math.round((performance.now() - start) / 1000),
    requests: samples.length,
    errorRate: failures.length / samples.length,
    p50: Math.round(
      percentile(
        samples.map((s) => s.ms),
        0.5,
      ),
    ),
    p95: Math.round(
      percentile(
        samples.map((s) => s.ms),
        0.95,
      ),
    ),
    byRoute: paths.map((path) => {
      const values = samples.filter((s) => s.path === path);
      return {
        path,
        requests: values.length,
        p95: Math.round(
          percentile(
            values.map((s) => s.ms),
            0.95,
          ),
        ),
        errors: values.filter((s) => s.status !== 200).length,
      };
    }),
    failures: failures.slice(0, 20),
  };
  await mkdir(".local/acceptance", { recursive: true });
  await writeFile(
    ".local/acceptance/load-result.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  expect(report.errorRate, "Server errors below 1%").toBeLessThan(0.01);
  expect(report.p95, "Local public read p95 below one second").toBeLessThan(
    1000,
  );
  expect(failures.some((f) => f.includes("Private marker"))).toBe(false);
});
