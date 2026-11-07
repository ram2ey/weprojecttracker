import { z } from "zod";

export const commentInput = z
  .object({
    submissionId: z.uuid(),
    displayName: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[^\u0000-\u001f\u007f]*$/u, "Use a single-line name."),
    body: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .regex(
        /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/u,
        "Remove unsupported characters.",
      ),
    website: z.string().max(2000),
  })
  .strict();

export type CommentItem = {
  id: string;
  displayName: string;
  body: string;
  createdAt: string;
};
export type CommentPage = {
  enabled: boolean;
  items: CommentItem[];
  page: number;
  hasMore: boolean;
};
export type ManagedComment = CommentItem & {
  recordId: string;
  projectTitle: string;
  hiddenAt: string | null;
  version: number;
};
export type CommentProject = {
  id: string;
  title: string;
  enabled: boolean;
  version: number;
};
export type ManagedPage = {
  items: ManagedComment[];
  projects: CommentProject[];
  page: number;
  hasMore: boolean;
};
