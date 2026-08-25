/**
 * Analytics API client — renders backend-aggregated payloads only.
 */

import { api, getAccessToken } from "./api";
import { buildListQuery } from "./pagination";
import type { Role } from "./roles";

export type AnalyticsDomain =
  | "overview"
  | "financial"
  | "appointments"
  | "patients"
  | "laboratory"
  | "pharmacy"
  | "ipd"
  | "radiology"
  | "billing"
  | "insurance"
  | "staff"
  | "void-audit"
  | "follow-ups";

export type AnalyticsPreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "last_180_days"
  | "last_365_days"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "last_year"
  | "custom";

export type AnalyticsCompare =
  | "none"
  | "previous_period"
  | "previous_month"
  | "previous_year";

export type AnalyticsGranularity =
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "year";

export type AnalyticsFilters = {
  preset?: AnalyticsPreset;
  from?: string;
  to?: string;
  compare?: AnalyticsCompare;
  granularity?: AnalyticsGranularity;
  departmentId?: string;
  doctorId?: string;
  status?: string;
  wardId?: string;
  paymentMethodId?: string;
  insurerId?: string;
};

export type AnalyticsKpi = {
  key: string;
  label: string;
  value: number;
  previousValue?: number | null;
  changePercent?: number | null;
  unit: "count" | "currency" | "percent" | "hours" | "days";
  definition: string;
  hasData: boolean;
};

export type AnalyticsSeries = {
  key: string;
  label: string;
  points: Array<{
    period: string;
    value: number;
    previousValue?: number | null;
  }>;
  hasData: boolean;
};

export type AnalyticsBreakdown = {
  key: string;
  label: string;
  rows: Array<{
    name: string;
    value: number;
    pct?: number | null;
    changePercent?: number | null;
  }>;
  hasData: boolean;
};

export type AnalyticsTable = {
  key: string;
  label: string;
  columns: string[];
  rows: Array<Record<string, string | number | null>>;
  hasData: boolean;
};

export type AnalyticsPayload = {
  meta: {
    from: string;
    to: string;
    compareFrom: string | null;
    compareTo: string | null;
    granularity: string;
    preset: string;
    compare: string;
    generatedAt: string;
    currency: "KES";
    domain: string;
  };
  kpis: AnalyticsKpi[];
  series: AnalyticsSeries[];
  breakdowns: AnalyticsBreakdown[];
  tables: AnalyticsTable[];
};

export const ANALYTICS_TABS: Array<{
  id: AnalyticsDomain;
  label: string;
  roles: Role[];
  filters: Array<
    "doctor" | "status" | "ward" | "paymentMethod" | "department"
  >;
}> = [
  {
    id: "overview",
    label: "Overview",
    roles: [
      "SUPER_ADMIN",
      "ADMIN",
      "ACCOUNTANT",
      "DOCTOR",
      "NURSE",
      "RECEPTIONIST",
      "PHARMACIST",
      "LAB_TECHNICIAN",
      "RADIOLOGIST",
    ],
    filters: ["doctor"],
  },
  {
    id: "financial",
    label: "Financial",
    roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"],
    filters: ["paymentMethod"],
  },
  {
    id: "appointments",
    label: "Appointments",
    roles: [
      "SUPER_ADMIN",
      "ADMIN",
      "DOCTOR",
      "NURSE",
      "RECEPTIONIST",
    ],
    filters: ["doctor", "status"],
  },
  {
    id: "patients",
    label: "Patients",
    roles: [
      "SUPER_ADMIN",
      "ADMIN",
      "DOCTOR",
      "NURSE",
      "RECEPTIONIST",
    ],
    filters: [],
  },
  {
    id: "laboratory",
    label: "Laboratory",
    roles: ["SUPER_ADMIN", "ADMIN", "LAB_TECHNICIAN", "DOCTOR"],
    filters: ["doctor", "status"],
  },
  {
    id: "pharmacy",
    label: "Pharmacy",
    roles: ["SUPER_ADMIN", "ADMIN", "PHARMACIST"],
    filters: [],
  },
  {
    id: "ipd",
    label: "IPD",
    roles: ["SUPER_ADMIN", "ADMIN", "DOCTOR", "NURSE"],
    filters: ["ward"],
  },
  {
    id: "radiology",
    label: "Radiology",
    roles: ["SUPER_ADMIN", "ADMIN", "RADIOLOGIST", "DOCTOR"],
    filters: ["doctor", "status"],
  },
  {
    id: "billing",
    label: "Billing",
    roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"],
    filters: ["paymentMethod"],
  },
  {
    id: "insurance",
    label: "Insurance",
    roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"],
    filters: ["status"],
  },
  {
    id: "staff",
    label: "Staff",
    roles: ["SUPER_ADMIN", "ADMIN"],
    filters: [],
  },
  {
    id: "follow-ups",
    label: "Follow-ups",
    roles: ["SUPER_ADMIN", "ADMIN", "DOCTOR", "RECEPTIONIST"],
    filters: ["status"],
  },
  {
    id: "void-audit",
    label: "Void Audit",
    roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"],
    filters: [],
  },
];

export const PRESET_OPTIONS: Array<{ value: AnalyticsPreset; label: string }> =
  [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "last_7_days", label: "Last 7 days" },
    { value: "last_30_days", label: "Last 30 days" },
    { value: "last_90_days", label: "Last 90 days (3 months)" },
    { value: "last_180_days", label: "Last 180 days (6 months)" },
    { value: "last_365_days", label: "Last 12 months" },
    { value: "this_week", label: "This week" },
    { value: "last_week", label: "Last week" },
    { value: "this_month", label: "This month" },
    { value: "last_month", label: "Last month" },
    { value: "this_quarter", label: "This quarter" },
    { value: "this_year", label: "This year" },
    { value: "last_year", label: "Last year" },
    { value: "custom", label: "Custom range" },
  ];

export function tabsForRole(role: Role) {
  return ANALYTICS_TABS.filter((t) => t.roles.includes(role));
}

export async function fetchAnalytics(
  domain: AnalyticsDomain,
  filters: AnalyticsFilters,
  init?: RequestInit,
): Promise<AnalyticsPayload> {
  const qs = buildListQuery({
    preset: filters.preset,
    from: filters.from,
    to: filters.to,
    compare: filters.compare,
    granularity: filters.granularity,
    departmentId: filters.departmentId,
    doctorId: filters.doctorId,
    status: filters.status,
    wardId: filters.wardId,
    paymentMethodId: filters.paymentMethodId,
    insurerId: filters.insurerId,
  });
  return api<AnalyticsPayload>(`/analytics/${domain}?${qs}`, init);
}

export async function exportAnalytics(
  domain: AnalyticsDomain,
  filters: AnalyticsFilters,
  format: "csv" | "xlsx" = "csv",
): Promise<void> {
  const API_URL =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://localhost:4000";
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/analytics/${domain}/export`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ...filters, format }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Export failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analytics-${domain}.${format === "csv" ? "csv" : "json"}`;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatMetricValue(
  value: number,
  unit: AnalyticsKpi["unit"],
): string {
  if (unit === "currency") {
    return `KES ${value.toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })}`;
  }
  if (unit === "percent") return `${value}%`;
  if (unit === "hours") return `${value} h`;
  if (unit === "days") return `${value} d`;
  return value.toLocaleString();
}

export const CHART_COLORS = [
  "#f02878",
  "#0d9488",
  "#2563eb",
  "#f59e0b",
  "#8b5cf6",
  "#64748b",
  "#ef4444",
  "#14b8a6",
];
