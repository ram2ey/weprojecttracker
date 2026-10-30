import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { TOTP, Secret } from "otpauth";
export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
function encryptionKey() {
  const value = process.env.MFA_ENCRYPTION_KEY ?? "";
  if (!/^[a-f0-9]{64}$/i.test(value))
    throw new Error("MFA encryption key is not configured.");
  return Buffer.from(value, "hex");
}
export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    "base64url",
  );
}
export function decrypt(value: string) {
  const bytes = Buffer.from(value, "base64url");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    bytes.subarray(0, 12),
  );
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([
    decipher.update(bytes.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
export function newTotp(email: string, secret?: string) {
  return new TOTP({
    issuer: "Wassa East Projects",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: secret ? Secret.fromBase32(secret) : new Secret({ size: 20 }),
  });
}
export function validateTotp(
  secret: string,
  code: string,
  lastStep: number,
  now = Date.now(),
) {
  if (!/^\d{6}$/.test(code)) return null;
  const delta = newTotp("staff", secret).validate({
    token: code,
    window: 1,
    timestamp: now,
  });
  if (delta === null) return null;
  const step = Math.floor(now / 30000) + delta;
  return step > lastStep ? step : null;
}
export function makeRecoveryCodes() {
  return Array.from({ length: 8 }, () => randomBytes(8).toString("hex"));
}
