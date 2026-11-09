export function publicOrigin(value) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new Error("Public app URL must be a trusted HTTPS origin.");
  return url.origin;
}

export async function smokePublicApp(
  value,
  { release, full = true, fetchImpl = fetch } = {},
) {
  const origin = publicOrigin(value);
  async function get(path, expected = 200, redirect = "error") {
    let response;
    try {
      response = await fetchImpl(origin + path, {
        redirect,
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new Error(`Public check could not reach ${path}.`);
    }
    if (response.status !== expected)
      throw new Error(
        `Public check failed for ${path} (HTTP ${response.status}).`,
      );
    return response;
  }
  const ready = await (await get("/api/ready")).json();
  if (
    ready.ready !== true ||
    (release && (ready.release !== release || ready.migrated !== true))
  )
    throw new Error(
      "Expected release and successful migrations are not ready.",
    );
  for (const path of full
    ? [
        "/",
        "/projects",
        "/about",
        "/contact",
        "/privacy",
        "/staff/login",
        "/sitemap.xml",
        "/robots.txt",
      ]
    : ["/"])
    await get(path);
  if (!full) return ready;
  const redirect = await get("/?q=school", 308, "manual");
  const target = new URL(redirect.headers.get("location") || "", origin);
  if (
    target.origin !== origin ||
    target.pathname !== "/projects" ||
    target.searchParams.get("q") !== "school"
  )
    throw new Error("Register redirect lost its query or origin.");
  for (const path of [
    "/reports",
    "/announcements",
    "/staff/setup",
    "/api/public/projects/map",
  ])
    await get(path, 404);
  await get("/api/staff/content", 403);
  const listing = await (await get("/api/public/content")).json();
  if (!Array.isArray(listing.items))
    throw new Error("Public register response is invalid.");
  const record = listing.items[0];
  if (record) {
    if (
      typeof record.slug !== "string" ||
      !record.payload ||
      "financials" in record ||
      "financials" in record.payload
    )
      throw new Error("Public project contract is invalid.");
    await get("/projects/" + encodeURIComponent(record.slug));
    const photo = record.payload.attachments?.[0];
    if (photo) {
      const response = await get("/api/media/" + encodeURIComponent(photo.id));
      if (!response.headers.get("content-type")?.startsWith("image/"))
        throw new Error("Public photograph is not an image.");
    }
  }
  return {
    ready: true,
    projectChecked: !!record,
    mediaChecked: !!record?.payload.attachments?.length,
  };
}
