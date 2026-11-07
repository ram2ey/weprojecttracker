export type ProjectStatus =
  "Planned" | "Ongoing" | "Completed" | "Delayed" | "Suspended" | "Cancelled";
export function statusTone(
  status: string,
): "green" | "amber" | "red" | "neutral" {
  return status === "Completed"
    ? "green"
    : status === "Ongoing" || status === "Planned"
      ? "neutral"
      : status === "Delayed"
        ? "amber"
        : "red";
}
