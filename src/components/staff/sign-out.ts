export const signOutErrorMessage =
  "Unable to sign out. Check your connection and try again.";

export async function signOut() {
  const response = await fetch("/api/auth/sign-out", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response.ok) throw new Error(signOutErrorMessage);
}
