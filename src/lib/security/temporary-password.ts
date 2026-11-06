export const TEMPORARY_PASSWORD_HOURS = 24;
export function temporaryPasswordExpiry(now = new Date()) {
  return new Date(now.getTime() + TEMPORARY_PASSWORD_HOURS * 60 * 60 * 1000);
}
export function temporaryPasswordExpired(
  person: {
    mustChangePassword: boolean;
    temporaryPasswordExpiresAt: Date | null;
  },
  now = new Date(),
) {
  return (
    person.mustChangePassword &&
    (!person.temporaryPasswordExpiresAt ||
      person.temporaryPasswordExpiresAt <= now)
  );
}
