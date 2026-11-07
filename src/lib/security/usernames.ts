import { z } from "zod";
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9_]+$/, "Use letters, numbers and underscores.");
export const passwordSchema = z.string().min(12).max(128);
