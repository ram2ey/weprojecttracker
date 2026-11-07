export function testDatabaseUrl(env = process.env) {
  const ci = env.CI === "true";
  if (ci && !env.TEST_DATABASE_URL)
    throw new Error("CI requires explicit TEST_DATABASE_URL.");
  const url = new URL(ci ? env.TEST_DATABASE_URL : env.DATABASE_URL);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.search ||
    url.hash ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "55432" ||
    (ci && url.pathname !== "/wassa_test")
  )
    throw new Error(
      "Tests require the isolated loopback PostgreSQL cluster and CI database wassa_test.",
    );
  url.pathname = "/wassa_test";
  return url;
}
