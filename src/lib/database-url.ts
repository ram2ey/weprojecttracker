type Environment = Record<string, string | undefined>;
export function databaseConfigured(env: Environment = process.env) {
  return !!(
    env.DATABASE_URL ||
    (env.PGHOST && env.PGDATABASE && env.PGUSER && env.PGPASSWORD)
  );
}
export function databaseUrl(env: Environment = process.env) {
  if (env.DATABASE_URL) {
    try {
      const value = new URL(env.DATABASE_URL);
      if (
        !["postgres:", "postgresql:"].includes(value.protocol) ||
        !value.hostname ||
        !value.pathname ||
        value.pathname === "/"
      )
        throw new Error();
      return value.toString();
    } catch {
      throw new Error(
        "DATABASE_URL must be a valid PostgreSQL connection URL.",
      );
    }
  }
  if (!databaseConfigured(env))
    throw new Error(
      "Configure DATABASE_URL or the PostgreSQL connection fields.",
    );
  const port = env.PGPORT || "5432";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
    throw new Error("PGPORT must be a valid TCP port.");
  try {
    const host = env.PGHOST!;
    if (!/^[a-z0-9.:[\]-]+$/i.test(host)) throw new Error();
    const hostname =
      host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
    const value = new URL(`postgresql://${hostname}:${port}`);
    value.username = encodeURIComponent(env.PGUSER!);
    value.password = encodeURIComponent(env.PGPASSWORD!);
    value.pathname = "/" + encodeURIComponent(env.PGDATABASE!);
    return value.toString();
  } catch {
    throw new Error("The PostgreSQL connection fields are invalid.");
  }
}
