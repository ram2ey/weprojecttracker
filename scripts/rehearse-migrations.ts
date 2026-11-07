import { config } from "dotenv";
import { randomUUID, createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  copyFile,
  unlink,
  rmdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { hashPassword } from "better-auth/crypto";
import { testDatabaseUrl } from "./test-database.mjs";

// Synthetic rehearsal only. Never connect to a remote host or a live database.
async function main() {
  if (process.env.CI !== "true") config({ path: ".env.local", quiet: true });
  const base = testDatabaseUrl();
  const name = "wassa_rehearsal_" + randomUUID().replaceAll("-", "");
  assert.match(name, /^wassa_rehearsal_[a-f0-9]{32}$/);
  const maintenance = new URL(base);
  maintenance.pathname = "/postgres";
  const admin = new Pool({ connectionString: maintenance.toString() });
  const target = new URL(base);
  target.pathname = "/" + name;
  const pool = new Pool({ connectionString: target.toString() });
  const folder = await mkdtemp(join(tmpdir(), "wassa-rehearsal-"));
  const files: string[] = [];
  let created = false;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    await mkdir(join(folder, "meta"));
    const legacy = { ...journal, entries: journal.entries.slice(0, 4) };
    await writeFile(join(folder, "meta/_journal.json"), JSON.stringify(legacy));
    files.push("meta/_journal.json");
    for (const entry of legacy.entries) {
      const filename = entry.tag + ".sql";
      await copyFile(join("drizzle", filename), join(folder, filename));
      files.push(filename);
    }
    await migrate(drizzle(pool), { migrationsFolder: folder });
    const password = "Synthetic-legacy-password-2026!";
    const hash = await hashPassword(password);
    for (const [index, email] of [
      "Same.Name@example.invalid",
      "same_name@other.invalid",
      "!!!@other.invalid",
    ].entries()) {
      const id = "fixture-" + index;
      await pool.query(
        'INSERT INTO "user" (id,name,email,created_at) VALUES ($1,$1,$2,$3)',
        [id, email, new Date(2020, 0, index + 1)],
      );
      await pool.query(
        "INSERT INTO staff (user_id,role,mfa_secret,mfa_enabled) VALUES ($1,$2,$3,true)",
        [
          id,
          index === 0 ? "super_admin" : "officer",
          "synthetic-legacy-encrypted-value",
        ],
      );
      await pool.query(
        "INSERT INTO account (id,account_id,provider_id,user_id,password) VALUES ($1,$1,'credential',$1,$2)",
        [id, hash],
      );
      await pool.query(
        "INSERT INTO session (id,token,user_id,expires_at) VALUES ($1,$1,$1,now()+interval '1 day')",
        [id],
      );
    }
    await pool.query(
      "INSERT INTO content_record (id,kind,slug,created_by) VALUES ('record','project','legacy-project','fixture-1')",
    );
    for (const [id, number, state] of [
      ["old", 1, "approved"],
      ["current", 2, "approved"],
      ["pending", 3, "pending"],
    ] as const) {
      await pool.query(
        `INSERT INTO content_revision (id,record_id,number,state,base_version,author_id,contributors,payload,financials)
      VALUES ($1,'record',$2,$3,0,'fixture-1','["fixture-1"]',$4,$5)`,
        [
          id,
          number,
          state,
          JSON.stringify({
            title: "Legacy " + id,
            objectives: "Preserve historical detail",
            attachments: [{ id: "photo" }],
          }),
          JSON.stringify({
            budget: 125000,
            privateNote: "Synthetic historical finance",
          }),
        ],
      );
    }
    await pool.query(
      "UPDATE content_record SET published_revision_id='current' WHERE id='record'",
    );
    const media = Buffer.from("Synthetic historical media bytes");
    await writeFile(join(folder, "historical-image"), media);
    files.push("historical-image");
    await pool.query(
      `INSERT INTO media_file (id,record_id,uploaded_by,original_name,mime_type,size,storage_key)
    VALUES ('photo','record','fixture-1','legacy.jpg','image/jpeg',$1,'historical-image')`,
      [media.length],
    );
    await pool.query(
      "INSERT INTO staff_link (id,user_id,token_hash,kind,expires_at) VALUES ('link','fixture-0','synthetic-hash','setup',now()+interval '1 day')",
    );
    const tables = (
      await pool.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
      )
    ).rows.map((r) => r.tablename as string);
    async function snapshot() {
      const result: Record<string, unknown> = {};
      for (const table of tables) {
        assert.match(table, /^[a-z_]+$/);
        if (["user", "staff", "session"].includes(table)) continue;
        result[table] = (
          await pool.query(`SELECT * FROM "${table}" ORDER BY 1`)
        ).rows;
      }
      return result;
    }
    const before = await snapshot();
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" }); // retry must preserve results
    assert.deepEqual(await snapshot(), before);
    assert.equal(
      createHash("sha256")
        .update(await readFile(join(folder, "historical-image")))
        .digest("hex"),
      createHash("sha256").update(media).digest("hex"),
    );
    const people = (
      await pool.query(
        'SELECT u.username,s.must_change_password,s.temporary_password_expires_at,s.access_version FROM "user" u JOIN staff s ON s.user_id=u.id ORDER BY u.id',
      )
    ).rows;
    assert.deepEqual(
      people.map((p) => p.username),
      ["same_name_1", "same_name_2", "____3"],
    );
    assert.ok(
      people.every(
        (p) =>
          p.must_change_password &&
          p.temporary_password_expires_at > new Date() &&
          p.access_version === 0,
      ),
    );
    assert.equal(
      (await pool.query("SELECT count(*)::int AS count FROM session")).rows[0]
        .count,
      0,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations",
        )
      ).rows[0].count,
      7,
    );
    // Exercise the same maintenance-reset and password-change functions used by operators.
    process.env.DATABASE_URL = target.toString();
    const { manageStaff, changeStaffPassword } =
      await import("../src/lib/security/accounts");
    const { getPool } = await import("../src/db");
    try {
      const reset = await manageStaff(
        { id: "fixture-0", role: "super_admin" },
        "fixture-0",
        "reset",
      );
      assert.ok(reset.temporaryPassword);
      await pool.query(
        "INSERT INTO session (id,token,user_id,expires_at) VALUES ('recovery','recovery','fixture-0',now()+interval '1 hour')",
      );
      await changeStaffPassword(
        "fixture-0",
        "recovery",
        reset.temporaryPassword!,
        password + "Changed",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT must_change_password FROM staff WHERE user_id='fixture-0'",
          )
        ).rows[0].must_change_password,
        false,
      );
      assert.equal(
        (await pool.query("SELECT count(*)::int AS count FROM session")).rows[0]
          .count,
        0,
      );
    } finally {
      await getPool().end();
    }
    console.log(
      "Migration rehearsal passed: 0003 → 0006; deterministic usernames, unchanged hashes/history/legacy tables/media, invalidated sessions, retry and operator recovery.",
    );
  } finally {
    await pool.end();
    if (created) await admin.query(`DROP DATABASE "${name}"`);
    await admin.end();
    for (const file of files) await unlink(join(folder, file));
    await rmdir(join(folder, "meta")).catch(() => {});
    await rmdir(folder);
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
