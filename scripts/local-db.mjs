import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { join, resolve } from "node:path";
const root = resolve(".local");
const data = join(root, "postgres");
const bin =
  process.env.POSTGRES_BIN ??
  (process.platform === "win32" ? "C:/Program Files/PostgreSQL/16/bin" : "");
const executable = (name) =>
  bin ? join(bin, name + (process.platform === "win32" ? ".exe" : "")) : name;
mkdirSync(root, { recursive: true });
if (process.argv[2] === "stop") {
  execFileSync(executable("pg_ctl"), ["-D", data, "-m", "fast", "stop"], {
    stdio: "inherit",
  });
  process.exit(0);
}
if (!existsSync(".env.local")) {
  const password = randomBytes(24).toString("hex");
  writeFileSync(
    ".env.local",
    `APP_ENV=development\nNEXT_PUBLIC_APP_URL=http://localhost:3000\nBETTER_AUTH_URL=http://localhost:3000\nBETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}\nMFA_ENCRYPTION_KEY=${randomBytes(32).toString("hex")}\nDATABASE_URL=postgresql://wassa:${password}@127.0.0.1:55432/wassa\nMEDIA_ROOT=./.local/media\nENABLE_DESIGN_PREVIEW=true\nGOOGLE_CLIENT_ID=\nGOOGLE_CLIENT_SECRET=\n`,
    { mode: 0o600, flag: "wx" },
  );
}
const env = readFileSync(".env.local", "utf8");
const connection = new URL(env.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "");
if (
  connection.hostname !== "127.0.0.1" ||
  connection.port !== "55432" ||
  connection.username !== "wassa"
)
  throw new Error(
    "Local database helper only manages the isolated wassa database on 127.0.0.1:55432.",
  );
if (!existsSync(join(data, "PG_VERSION"))) {
  const passwordFile = join(root, "initdb-password");
  try {
    writeFileSync(passwordFile, decodeURIComponent(connection.password), {
      mode: 0o600,
    });
    execFileSync(
      executable("initdb"),
      [
        "-D",
        data,
        "-U",
        "wassa",
        "--pwfile",
        passwordFile,
        "--auth=scram-sha-256",
        "--encoding=UTF8",
        "--locale=C",
      ],
      { stdio: "inherit" },
    );
  } finally {
    if (existsSync(passwordFile)) unlinkSync(passwordFile);
  }
}
try {
  execFileSync(executable("pg_ctl"), ["-D", data, "status"], {
    stdio: "ignore",
  });
} catch {
  execFileSync(
    executable("pg_ctl"),
    [
      "-D",
      data,
      "-l",
      join(root, "postgres.log"),
      "-o",
      "-h 127.0.0.1 -p 55432",
      "-w",
      "start",
    ],
    { stdio: "inherit" },
  );
}
const pgEnv = {
  ...process.env,
  PGPASSWORD: decodeURIComponent(connection.password),
};
const output = execFileSync(
  executable("psql"),
  [
    "-h",
    "127.0.0.1",
    "-p",
    "55432",
    "-U",
    "wassa",
    "-d",
    "postgres",
    "-tAc",
    "SELECT 1 FROM pg_database WHERE datname = 'wassa'",
  ],
  { env: pgEnv, encoding: "utf8" },
);
if (output.trim() !== "1")
  execFileSync(
    executable("createdb"),
    ["-h", "127.0.0.1", "-p", "55432", "-U", "wassa", "wassa"],
    { env: pgEnv, stdio: "inherit" },
  );
mkdirSync(join(root, "media"), { recursive: true });
console.log(
  "Isolated development database ready on 127.0.0.1:55432. Secrets remain in .env.local.",
);
