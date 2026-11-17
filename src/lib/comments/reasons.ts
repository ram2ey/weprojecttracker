// Shared by the public Report form and server validation; no dependencies so
// client bundles stay small.
export const reportReasons = [
  ["spam", "Spam or advertising"],
  ["abuse", "Abusive, hateful or threatening"],
  ["private", "Shares someone’s private information"],
  ["other", "Something else"],
] as const;
export type ReportReason = (typeof reportReasons)[number][0];
export const reasonLabels: Record<ReportReason | "unspecified", string> = {
  ...(Object.fromEntries(reportReasons) as Record<ReportReason, string>),
  unspecified: "No reason given",
};
