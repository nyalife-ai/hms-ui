export type Role =
  | "ADMIN"
  | "SUPER_ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "RECEPTIONIST"
  | "PHARMACIST"
  | "LAB_TECHNICIAN"
  | "RADIOLOGIST"
  | "ACCOUNTANT";

export const ALL_ROLES: Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "DOCTOR",
  "NURSE",
  "RECEPTIONIST",
  "PHARMACIST",
  "LAB_TECHNICIAN",
  "RADIOLOGIST",
  "ACCOUNTANT",
];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "System administrator",
  ADMIN: "Administrator",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  RECEPTIONIST: "Receptionist",
  PHARMACIST: "Pharmacist",
  LAB_TECHNICIAN: "Lab Technician",
  RADIOLOGIST: "Radiologist",
  ACCOUNTANT: "Accountant",
};

/** Front desk operators who book appointments and check patients in. */
export const FRONT_DESK_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "RECEPTIONIST"];

/**
 * Strict per-desk access (mirrors backend ROLE_MODULE_ACCESS).
 * Each operating role owns one desk; ADMIN is oversight/config only.
 * SUPER_ADMIN is for testing / full UI walkthrough — not a clinic desk.
 */
export const MODULE_ACCESS: Record<string, Role[]> = {
  dashboard: ALL_ROLES,
  "front-desk": ["SUPER_ADMIN", "RECEPTIONIST"],
  triage: ["SUPER_ADMIN", "NURSE"],
  consultations: ["SUPER_ADMIN", "ADMIN", "DOCTOR"],
  patients: ["SUPER_ADMIN", "ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"],
  appointments: ["SUPER_ADMIN", "ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"],
  "follow-ups": ["SUPER_ADMIN", "ADMIN", "DOCTOR", "RECEPTIONIST"],
  doctors: ["SUPER_ADMIN", "RECEPTIONIST"],
  departments: ["SUPER_ADMIN", "ADMIN"],
  inpatient: ["SUPER_ADMIN", "DOCTOR", "NURSE"],
  pharmacy: ["SUPER_ADMIN", "PHARMACIST"],
  laboratory: ["SUPER_ADMIN", "LAB_TECHNICIAN"],
  radiology: ["SUPER_ADMIN", "RADIOLOGIST"],
  /** Cash desk / invoices / payments / claims */
  billing: ["SUPER_ADMIN", "ADMIN", "RECEPTIONIST", "ACCOUNTANT"],
  /** Chart of accounts, journals, tax, periods, service catalog config */
  "billing-ledger": ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"],
  messages: ALL_ROLES,
  staff: ["SUPER_ADMIN", "ADMIN"],
  settings: ["SUPER_ADMIN", "ADMIN"],
};

/**
 * Role allow-list is the product truth. JWT permissions may further restrict,
 * but cannot grant modules the role is not supposed to operate.
 * SUPER_ADMIN bypasses module allow-lists (still respects explicit deny via empty perms only if we add that later).
 */
export function canAccess(
  role: Role,
  module: keyof typeof MODULE_ACCESS,
  permissions?: string[],
): boolean {
  if (role === "SUPER_ADMIN") {
    if (!permissions?.length) return true;
    return (
      permissions.includes("*") || permissions.includes(`module:${module}`)
    );
  }
  if (!(MODULE_ACCESS[module]?.includes(role) ?? false)) {
    return false;
  }
  if (!permissions?.length) {
    return true;
  }
  return (
    permissions.includes("*") || permissions.includes(`module:${module}`)
  );
}

export function canAccessAny(
  role: Role,
  modules: Array<keyof typeof MODULE_ACCESS>,
  permissions?: string[],
): boolean {
  return modules.some((module) => canAccess(role, module, permissions));
}

/** Oversight roles may view and edit any OPD stage. */
export function isOversightRole(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}
