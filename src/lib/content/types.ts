export const contentKinds = ["project", "announcement", "report"] as const;
export type ContentKind = (typeof contentKinds)[number];
export const projectStatuses = [
  "Planned",
  "Ongoing",
  "Completed",
  "Delayed",
  "Suspended",
  "Cancelled",
] as const;
export const workflowStates = [
  "draft",
  "pending",
  "returned",
  "rejected",
  "approved",
] as const;
export type WorkflowState = (typeof workflowStates)[number];
export type AttachmentRef = {
  id: string;
  caption: string;
  capturedOn: string;
  visibility: "public" | "internal";
  purpose: "evidence" | "financial";
};
export type Milestone = {
  title: string;
  description: string;
  date: string;
  achieved: boolean;
};
export type ContentPayload = {
  title: string;
  description: string;
  objectives: string;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  communityId: string;
  communityName: string;
  region: string;
  constituency: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  status: (typeof projectStatuses)[number];
  progress: number;
  progressExplanation: string;
  startDate: string;
  expectedCompletionDate: string;
  actualCompletionDate: string;
  completionSummary: string;
  changeSummary: string;
  delayReason: string;
  nextSteps: string;
  source: string;
  responsibleOrganisation: string;
  reportingOffice: string;
  verificationNotes: string;
  tags: string[];
  references: { label: string; url: string }[];
  videoLinks: string[];
  milestones: Milestone[];
  attachments: AttachmentRef[];
};
export type Financials = {
  budget: string;
  expenditure: string;
  fundingSource: string;
  currency: "GHS";
  internalNotes: string;
};
export type Taxonomy = {
  id: string;
  kind: "category" | "subcategory" | "community";
  name: string;
  parentId: string | null;
  active: boolean;
};
export const emptyPayload: ContentPayload = {
  title: "",
  description: "",
  objectives: "",
  categoryId: "",
  categoryName: "",
  subcategoryId: "",
  subcategoryName: "",
  communityId: "",
  communityName: "",
  region: "Western",
  constituency: "Wassa East",
  district: "Wassa East",
  latitude: null,
  longitude: null,
  status: "Planned",
  progress: 0,
  progressExplanation: "",
  startDate: "",
  expectedCompletionDate: "",
  actualCompletionDate: "",
  completionSummary: "",
  changeSummary: "",
  delayReason: "",
  nextSteps: "",
  source: "",
  responsibleOrganisation: "",
  reportingOffice: "",
  verificationNotes: "",
  tags: [],
  references: [],
  videoLinks: [],
  milestones: [],
  attachments: [],
};
export const emptyFinancials: Financials = {
  budget: "",
  expenditure: "",
  fundingSource: "",
  currency: "GHS",
  internalNotes: "",
};
export type AdminRevision = {
  id: string;
  number: number;
  state: WorkflowState;
  lockVersion: number;
  authorId: string;
  contributors: string[];
  submittedBy: string | null;
  submittedAt: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
  updatedAt: string;
  payload: ContentPayload;
  financials: Financials;
  baseVersion: number;
};
export type AdminFile = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  internalOnly: boolean;
  withdrawn: boolean;
};
export type AdminRecord = {
  commentsEnabled: boolean;
  reminderDays: number;
  engagementVersion: number;
  id: string;
  code: string;
  kind: ContentKind;
  slug: string;
  publishedRevisionId: string | null;
  version: number;
  withdrawnAt: string | null;
  withdrawalReason: string | null;
  revisions: AdminRevision[];
  files: AdminFile[];
};
export type AdminRecordSummary = {
  id: string;
  code: string;
  kind: ContentKind;
  slug: string;
  title: string;
  community: string;
  status: string;
  state: WorkflowState;
  revisionId: string;
  progress: number;
  submittedAt: string | null;
  published: boolean;
  withdrawn: boolean;
  updatedAt: string;
};
export type PublicContent = {
  id: string;
  code: string;
  kind: ContentKind;
  slug: string;
  revisionId: string;
  publishedAt: string;
  payload: ContentPayload;
  history: { number: number; publishedAt: string; payload: ContentPayload }[];
};
