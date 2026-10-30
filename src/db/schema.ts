import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  jsonb,
  index,
  serial,
  uniqueIndex,
  pgEnum,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { ContentPayload, Financials } from "../lib/content/types";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
export const staff = pgTable("staff", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role", {
    enum: ["super_admin", "officer", "approver"],
  }).notNull(),
  active: boolean("active").notNull().default(true),
  mfaSecret: text("mfa_secret"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaLastStep: integer("mfa_last_step").notNull().default(-1),
  recoveryHashes: jsonb("recovery_hashes")
    .$type<string[]>()
    .notNull()
    .default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const staffSession = pgTable("staff_session", {
  sessionId: text("session_id")
    .primaryKey()
    .references(() => session.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  verifiedAt: timestamp("verified_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});
export const staffLink = pgTable("staff_link", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  kind: text("kind", { enum: ["setup", "reset"] }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").references(() => user.id),
  action: text("action").notNull(),
  subjectId: text("subject_id"),
  details: jsonb("details").$type<Record<string, string>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const rateLimit = pgTable("app_rate_limit", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetsAt: timestamp("resets_at").notNull(),
});
export const authRateLimit = pgTable("auth_rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export const taxonomyKind = pgEnum("taxonomy_kind", [
  "category",
  "subcategory",
  "community",
]);
export const contentKind = pgEnum("content_kind", [
  "project",
  "announcement",
  "report",
]);
export const revisionState = pgEnum("revision_state", [
  "draft",
  "pending",
  "returned",
  "rejected",
  "approved",
]);
export const taxonomy = pgTable(
  "taxonomy",
  {
    id: text("id").primaryKey(),
    kind: taxonomyKind("kind").notNull(),
    name: text("name").notNull(),
    parentId: text("parent_id").references((): AnyPgColumn => taxonomy.id),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("taxonomy_name_unique").on(
      t.kind,
      sql`coalesce(${t.parentId}, '')`,
      sql`lower(${t.name})`,
    ),
  ],
);
export const contentRecord = pgTable(
  "content_record",
  {
    id: text("id").primaryKey(),
    number: serial("number").notNull().unique(),
    kind: contentKind("kind").notNull(),
    slug: text("slug").notNull().unique(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    publishedRevisionId: text("published_revision_id").references(
      (): AnyPgColumn => contentRevision.id,
    ),
    version: integer("version").notNull().default(0),
    commentsEnabled: boolean("comments_enabled").notNull().default(true),
    reminderDays: integer("reminder_days").notNull().default(30),
    engagementVersion: integer("engagement_version").notNull().default(0),
    withdrawnAt: timestamp("withdrawn_at"),
    withdrawalReason: text("withdrawal_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("record_public_idx").on(t.kind, t.withdrawnAt),
    index("record_updated_idx").on(t.updatedAt),
  ],
);
export const contentRevision = pgTable(
  "content_revision",
  {
    id: text("id").primaryKey(),
    recordId: text("record_id")
      .notNull()
      .references(() => contentRecord.id),
    number: integer("number").notNull(),
    state: revisionState("state").notNull().default("draft"),
    lockVersion: integer("lock_version").notNull().default(0),
    baseVersion: integer("base_version").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    contributors: jsonb("contributors").$type<string[]>().notNull(),
    payload: jsonb("payload").$type<ContentPayload>().notNull(),
    financials: jsonb("financials").$type<Financials>().notNull(),
    submittedBy: text("submitted_by").references(() => user.id),
    submittedAt: timestamp("submitted_at"),
    decidedBy: text("decided_by").references(() => user.id),
    decidedAt: timestamp("decided_at"),
    decisionReason: text("decision_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("revision_record_number_unique").on(t.recordId, t.number),
    index("revision_queue_idx").on(t.state, t.submittedAt),
    uniqueIndex("revision_one_active_per_record")
      .on(t.recordId)
      .where(sql`${t.state} in ('draft', 'pending')`),
  ],
);
export const mediaFile = pgTable(
  "media_file",
  {
    id: text("id").primaryKey(),
    recordId: text("record_id")
      .notNull()
      .references(() => contentRecord.id),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    thumbnailKey: text("thumbnail_key"),
    internalOnly: boolean("internal_only").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    withdrawnAt: timestamp("withdrawn_at"),
    withdrawalReason: text("withdrawal_reason"),
    withdrawnBy: text("withdrawn_by").references(() => user.id),
  },
  (t) => [index("media_record_idx").on(t.recordId)],
);

export const guestDevice = pgTable("guest_device", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
});
export const guestChallenge = pgTable("guest_challenge", {
  id: text("id").primaryKey(),
  deviceId: text("device_id")
    .notNull()
    .references(() => guestDevice.id, { onDelete: "cascade" }),
  answerHash: text("answer_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
});
export const guestSubmission = pgTable(
  "guest_submission",
  {
    id: text("id").primaryKey(),
    recordId: text("record_id")
      .notNull()
      .references(() => contentRecord.id, { onDelete: "cascade" }),
    deviceId: text("device_id").references(() => guestDevice.id, {
      onDelete: "set null",
    }),
    staffAuthorId: text("staff_author_id").references(() => user.id, {
      onDelete: "set null",
    }),
    kind: text("kind", {
      enum: ["comment", "feedback", "correction", "report"],
    }).notNull(),
    parentId: text("parent_id").references(
      (): AnyPgColumn => guestSubmission.id,
      { onDelete: "cascade" },
    ),
    displayName: text("display_name"),
    body: text("body").notNull(),
    state: text("state", {
      enum: ["pending", "approved", "rejected", "withdrawn", "resolved"],
    })
      .notNull()
      .default("pending"),
    version: integer("version").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    decidedAt: timestamp("decided_at"),
    decidedBy: text("decided_by").references(() => user.id, {
      onDelete: "set null",
    }),
    decisionReason: text("decision_reason"),
  },
  (t) => [
    index("submission_queue_idx").on(t.state, t.createdAt),
    index("submission_public_idx").on(t.recordId, t.kind, t.state),
  ],
);
export const officialReply = pgTable(
  "official_reply",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => guestSubmission.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => user.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    state: text("state", {
      enum: ["pending", "approved", "rejected", "withdrawn"],
    })
      .notNull()
      .default("pending"),
    version: integer("version").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    decidedAt: timestamp("decided_at"),
    decidedBy: text("decided_by").references(() => user.id, {
      onDelete: "set null",
    }),
    decisionReason: text("decision_reason"),
  },
  (t) => [index("reply_queue_idx").on(t.state, t.createdAt)],
);
export const abuseLog = pgTable(
  "abuse_log",
  {
    id: text("id").primaryKey(),
    fingerprint: text("fingerprint").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("abuse_retention_idx").on(t.createdAt)],
);
export const staffNotice = pgTable(
  "staff_notice",
  {
    id: text("id").primaryKey(),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    recordId: text("record_id").references(() => contentRecord.id, {
      onDelete: "cascade",
    }),
    kind: text("kind").notNull(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    subjectId: text("subject_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    readAt: timestamp("read_at"),
  },
  (t) => [index("notice_inbox_idx").on(t.recipientId, t.readAt, t.createdAt)],
);
export const pushSubscription = pgTable("push_subscription", {
  id: text("id").primaryKey(),
  deviceId: text("device_id")
    .notNull()
    .references(() => guestDevice.id, { onDelete: "cascade" }),
  endpointHash: text("endpoint_hash").notNull().unique(),
  credentials: text("credentials").notNull(),
  recordIds: jsonb("record_ids").$type<string[]>().notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastStatus: integer("last_status"),
});
export const pushJob = pgTable(
  "push_job",
  {
    id: text("id").primaryKey(),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => pushSubscription.id, { onDelete: "cascade" }),
    recordId: text("record_id")
      .notNull()
      .references(() => contentRecord.id, { onDelete: "cascade" }),
    revisionId: text("revision_id")
      .notNull()
      .references(() => contentRevision.id, { onDelete: "cascade" }),
    state: text("state", {
      enum: ["pending", "sending", "retry", "sent", "cancelled", "failed"],
    })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at").notNull().defaultNow(),
    lastStatus: integer("last_status"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("push_revision_unique").on(t.subscriptionId, t.revisionId),
    index("push_dispatch_idx").on(t.state, t.nextAttemptAt),
  ],
);
export const reportSource = pgTable(
  "report_source",
  {
    id: text("id").primaryKey(),
    reportRecordId: text("report_record_id")
      .notNull()
      .references(() => contentRecord.id, { onDelete: "cascade" }),
    sourceRecordId: text("source_record_id")
      .notNull()
      .references(() => contentRecord.id, { onDelete: "cascade" }),
    sourceRevisionId: text("source_revision_id")
      .notNull()
      .references(() => contentRevision.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("report_source_lookup_idx").on(t.sourceRecordId, t.reportRecordId),
  ],
);
