export type Role = "super_admin" | "officer" | "approver";
export function canManageStaff(role: Role) {
  return role === "super_admin";
}
export function canSubmit(role: Role) {
  return role === "officer" || role === "super_admin";
}
export function canApprove(role: Role, actorId: string, authorId: string) {
  return (
    (role === "approver" || role === "super_admin") && actorId !== authorId
  );
}
