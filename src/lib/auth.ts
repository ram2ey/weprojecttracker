import { betterAuth, APIError } from "better-auth";
import { username } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { appUrl, validateRuntime } from "./env";
import { temporaryPasswordExpired } from "./security/temporary-password";
function createAuth() {
  validateRuntime();
  const db = getDb();
  return betterAuth({
    appName: "Wassa East Projects",
    baseURL: appUrl(),
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    trustedOrigins: [appUrl()],
    plugins: [
      username({
        displayUsername: false,
        immutableUsername: true,
        usernameValidator: (v) => /^[a-zA-Z0-9_]+$/.test(v),
      }),
    ],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 8,
      updateAge: 60 * 60,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "authRateLimit",
      window: 60,
      max: 20,
    },
    databaseHooks: {
      user: {
        create: {
          before: async () => {
            throw new APIError("FORBIDDEN", {
              message: "An admin must create staff accounts.",
            });
          },
        },
      },
      session: {
        create: {
          before: async (record) => {
            const person = await db.query.staff.findFirst({
              where: eq(schema.staff.userId, record.userId),
            });
            if (!person?.active)
              throw new APIError("FORBIDDEN", {
                message: "Account unavailable.",
              });
            if (temporaryPasswordExpired(person))
              throw new APIError("FORBIDDEN", {
                message:
                  "Temporary password expired. Ask another admin to reset it.",
              });
            return { data: record };
          },
        },
      },
    },
  });
}
let auth: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (auth ??= createAuth());
}
