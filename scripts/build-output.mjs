export function buildDirectory(value, fallback) {
  const directory = value || fallback;
  if (!/^\.next(?:-[a-zA-Z0-9_-]+)?$/.test(directory))
    throw new Error(
      "Build output must be a project-local .next or .next-<name> directory.",
    );
  return directory;
}
