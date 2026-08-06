import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  BedDouble,
  Pill,
  FlaskConical,
  ScanLine,
  Receipt,
  MessageSquare,
  UserCog,
  Settings,
  Stethoscope,
  Building2,
  ConciergeBell,
  Activity,
  ClipboardPlus,
} from "lucide-react";
import { canAccess, MODULE_ACCESS, type Role } from "./roles";

export interface NavChild {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  module: keyof typeof MODULE_ACCESS;
  children?: NavChild[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
    ],
  },
  {
    title: "Patient Flow",
    items: [
      { label: "Front Desk", href: "/front-desk", icon: ConciergeBell, module: "front-desk" },
      { label: "Triage", href: "/triage", icon: Activity, module: "triage" },
      { label: "Consultations", href: "/consultations", icon: ClipboardPlus, module: "consultations" },
    ],
  },
  {
    title: "Clinical",
    items: [
      { label: "Appointments", href: "/appointments", icon: CalendarDays, module: "appointments" },
      { label: "Patients", href: "/patients", icon: Users, module: "patients" },
      { label: "Doctors", href: "/doctors", icon: Stethoscope, module: "doctors" },
      {
        label: "IPD",
        href: "/inpatient",
        icon: BedDouble,
        module: "inpatient",
        children: [
          { label: "Overview", href: "/inpatient" },
          { label: "Admissions", href: "/inpatient/admissions" },
          { label: "Wards", href: "/inpatient/wards" },
          { label: "Beds", href: "/inpatient/beds" },
          { label: "Reservations", href: "/inpatient/reservations" },
          { label: "Nursing / Clinical", href: "/inpatient/nursing" },
        ],
      },
    ],
  },
  {
    title: "Organization",
    items: [
      { label: "Departments", href: "/departments", icon: Building2, module: "departments" },
      { label: "Staff & Roles", href: "/staff", icon: UserCog, module: "staff" },
    ],
  },
  {
    title: "Diagnostics & Inventory",
    items: [
      {
        label: "Laboratory",
        href: "/laboratory",
        icon: FlaskConical,
        module: "laboratory",
        children: [
          { label: "Overview", href: "/laboratory" },
          { label: "Test Types", href: "/laboratory/test-types" },
          { label: "Requests", href: "/laboratory/requests" },
          { label: "Samples", href: "/laboratory/samples" },
          { label: "Results", href: "/laboratory/results" },
        ],
      },
      { label: "Radiology", href: "/radiology", icon: ScanLine, module: "radiology" },
      {
        label: "Pharmacy",
        href: "/pharmacy",
        icon: Pill,
        module: "pharmacy",
        children: [
          { label: "Overview", href: "/pharmacy" },
          { label: "Medications", href: "/pharmacy/medications" },
          { label: "Batches", href: "/pharmacy/batches" },
          { label: "Suppliers", href: "/pharmacy/suppliers" },
          { label: "Purchase Orders", href: "/pharmacy/purchase-orders" },
          { label: "Prescriptions", href: "/pharmacy/prescriptions" },
        ],
      },
    ],
  },
  {
    title: "General",
    items: [
      { label: "Billing", href: "/billing", icon: Receipt, module: "billing" },
      { label: "Messages", href: "/messages", icon: MessageSquare, module: "messages" },
      { label: "Settings", href: "/settings", icon: Settings, module: "settings" },
    ],
  },
];

/** Return only the nav sections/items visible to the given role / permissions. */
export function navForRole(role: Role, permissions?: string[]): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      canAccess(role, item.module, permissions),
    ),
  })).filter((section) => section.items.length > 0);
}
