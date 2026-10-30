export async function contentRequest<T>(
  url: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({
    message: "The server response could not be read. Please retry.",
  }));
  if (!response.ok) throw new Error(data.message || "The operation failed.");
  return data as T;
}
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to complete this operation.";
}
