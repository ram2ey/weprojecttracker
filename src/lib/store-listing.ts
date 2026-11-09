export function storeListing(store: "google" | "apple", value?: string) {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return;
    const valid =
      store === "google"
        ? url.hostname === "play.google.com" &&
          url.pathname === "/store/apps/details" &&
          !!url.searchParams.get("id")
        : url.hostname === "apps.apple.com" &&
          /^\/(?:[a-z]{2}\/)?app\/(?:[^/]+\/)?id\d+\/?$/.test(url.pathname);
    if (valid) return url.href;
  } catch {
    return;
  }
}
