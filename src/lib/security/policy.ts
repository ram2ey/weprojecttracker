// Since 12 November 2026 every staff account is an Admin with every
// permission, including publishing its own work. The stored value stays
// "super_admin" so existing sessions, audit entries and backups keep meaning
// the same thing; migration 0012 converted the retired editor ("officer") and
// approver roles.
export type Role = "super_admin";
export const roleLabel = "Admin";
export function canManageStaff(role: Role) {
  return role === "super_admin";
}
export function canSubmit(role: Role) {
  return role === "super_admin";
}
export function canApprove(role: Role) {
  return role === "super_admin";
}
