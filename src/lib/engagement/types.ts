export const submissionKinds = [
  "comment",
  "feedback",
  "correction",
  "report",
] as const;
export type SubmissionKind = (typeof submissionKinds)[number];
export type SubmissionState =
  "pending" | "approved" | "rejected" | "withdrawn" | "resolved";
export type PublicReply = { id: string; body: string; publishedAt: string };
export type PublicComment = {
  id: string;
  displayName: string;
  body: string;
  createdAt: string;
  replies: PublicReply[];
};
export type OwnSubmission = {
  id: string;
  kind: SubmissionKind;
  body: string;
  state: SubmissionState;
  createdAt: string;
  replies: PublicReply[];
};
export type ModerationRow = {
  id: string;
  record_id: string;
  kind: SubmissionKind;
  display_name: string | null;
  body: string;
  state: SubmissionState;
  version: number;
  created_at: string;
  staff_author_id: string | null;
  decision_reason: string | null;
  title: string;
  slug: string;
  replies: ReplyRow[];
};
export type ReplyRow = {
  id: string;
  submission_id: string;
  author_id: string | null;
  body: string;
  state: "pending" | "approved" | "rejected" | "withdrawn";
  version: number;
  created_at: string;
  decision_reason: string | null;
};
