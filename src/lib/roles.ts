export type Role =
  | "ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "RECEPTIONIST"
  | "PHARMACIST"
  | "LAB_TECHNICIAN"
  | "RADIOLOGIST"
  | "ACCOUNTANT";

export const ALL_ROLES: Role[] = [
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
  ADMIN: "Administrator",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  RECEPTIONIST: "Receptionist",
  PHARMACIST: "Pharmacist",
  LAB_TECHNICIAN: "Lab Technician",
  RADIOLOGIST: "Radiologist",
  ACCOUNTANT: "Accountant",
};

/**
 * Strict per-desk access (mirrors backend ROLE_MODULE_ACCESS).
 * Each operating role owns one desk; ADMIN is oversight/config only.
 */
export const MODULE_ACCESS: Record<string, Role[]> = {
  dashboard: ALL_ROLES,
  "front-desk": ["RECEPTIONIST"],
  triage: ["NURSE"],
  consultations: ["DOCTOR"],
  patients: ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"],
  appointments: ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"],
  doctors: ["RECEPTIONIST"],
  departments: ["ADMIN"],
  inpatient: ["DOCTOR", "NURSE"],
  pharmacy: ["PHARMACIST"],
  laboratory: ["LAB_TECHNICIAN"],
  radiology: ["RADIOLOGIST"],
  billing: ["ADMIN", "RECEPTIONIST", "ACCOUNTANT"],
  messages: ALL_ROLES,
  staff: ["ADMIN"],
  settings: ["ADMIN"],
};

/**
 * Role allow-list is the product truth. JWT permissions may further restrict,
 * but cannot grant modules the role is not supposed to operate.
 */
export function canAccess(
  role: Role,
  module: keyof typeof MODULE_ACCESS,
  permissions?: string[],
): boolean {
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
