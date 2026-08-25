import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  CalendarDays,
  BedDouble,
  Pill,
  FlaskConical,
  ScanLine,
  Receipt,
  MessageSquare,
  UserCog,
  UserCircle,
  Settings,
  Stethoscope,
  Building2,
  ConciergeBell,
  Activity,
  ClipboardPlus,
  BarChart3,
} from "lucide-react";
import { canAccess, MODULE_ACCESS, type Role } from "./roles";

export interface NavChild {
  label: string;
  href: string;
  /** When set, child is filtered separately from the parent module. */
  module?: keyof typeof MODULE_ACCESS;
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
      {
        label: "Reports & Analytics",
        href: "/reports",
        icon: BarChart3,
        module: "reports",
      },
    ],
  },
  {
    title: "Patient Flow",
    items: [
      { label: "Front Desk", href: "/front-desk", icon: ConciergeBell, module: "front-desk" },
      { label: "Triage", href: "/triage", icon: Activity, module: "triage" },
      { label: "Consultations", href: "/consultations", icon: ClipboardPlus, module: "consultations" },
      { label: "Follow-ups", href: "/follow-ups", icon: CalendarClock, module: "follow-ups" },
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
          { label: "Services & Procedures", href: "/laboratory/services" },
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
          { label: "Categories", href: "/pharmacy/categories" },
          { label: "Batches", href: "/pharmacy/batches" },
          { label: "Stock ledger", href: "/pharmacy/stock" },
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
      {
        label: "Billing",
        href: "/billing",
        icon: Receipt,
        module: "billing",
        children: [
          { label: "Overview", href: "/billing", module: "billing" },
          { label: "Invoices", href: "/billing/invoices", module: "billing" },
          { label: "Payments", href: "/billing/payments", module: "billing" },
          { label: "Claims", href: "/billing/claims", module: "billing" },
          { label: "Services", href: "/billing/services", module: "billing-ledger" },
          { label: "Accounts", href: "/billing/accounts", module: "billing-ledger" },
          { label: "Journals", href: "/billing/journals", module: "billing-ledger" },
          { label: "Tax rates", href: "/billing/tax-rates", module: "billing-ledger" },
          { label: "Periods", href: "/billing/periods", module: "billing-ledger" },
        ],
      },
      { label: "Messages", href: "/messages", icon: MessageSquare, module: "messages" },
      {
        label: "My Account",
        href: "/account",
        icon: UserCircle,
        module: "account",
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        module: "settings",
        children: [
          { label: "Hospital", href: "/settings", module: "settings" },
          { label: "Audit logs", href: "/settings/audit", module: "settings" },
        ],
      },
    ],
  },
];

/** Return only the nav sections/items visible to the given role / permissions. */
export function navForRole(role: Role, permissions?: string[]): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items
      .filter((item) => canAccess(role, item.module, permissions))
      .map((item) => {
        if (!item.children?.length) return item;
        const children = item.children.filter((child) =>
          canAccess(role, child.module ?? item.module, permissions),
        );
        return { ...item, children };
      }),
  })).filter((section) => section.items.length > 0);
}
