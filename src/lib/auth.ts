import { betterAuth, APIError } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { appUrl, validateRuntime } from "./env";

function createAuth() {
  validateRuntime();
  const db = getDb();
  return betterAuth({
    appName: "Wassa East Projects",
    baseURL: appUrl(),
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    trustedOrigins: [appUrl()],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    socialProviders:
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
              disableImplicitSignUp: true,
            },
          }
        : {},
    account: {
      accountLinking: { enabled: true, trustedProviders: ["google"] },
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
              message: "Staff accounts must be created by the operator.",
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
                message: "This staff account is not authorised.",
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
