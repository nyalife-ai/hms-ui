"use client";

import {
  Download,
  RefreshCw,
  Activity,
  Banknote,
  BedDouble,
  CalendarDays,
  FlaskConical,
  Pill,
  Receipt,
  ScanLine,
  ShieldAlert,
  Users,
  UserCog,
  CalendarClock,
  BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AnalyticsBarChart,
  AnalyticsDonutChart,
  AnalyticsLineChart,
} from "@/components/charts";
import { RoleGuard } from "@/components/role-guard";
import {
  Card,
  CardHeader,
  OutlineButton,
  PageHeader,
  PrimaryButton,
  StatCard,
  StatCardSkeleton,
  Table,
  cell,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  type AnalyticsDomain,
  type AnalyticsFilters,
  type AnalyticsPayload,
  type AnalyticsPreset,
  type AnalyticsSeries,
  type AnalyticsBreakdown,
  type AnalyticsTable,
  PRESET_OPTIONS,
  exportAnalytics,
  fetchAnalytics,
  formatMetricValue,
  tabsForRole,
} from "@/lib/analytics";
import {
  useDepartments,
  useDoctors,
  useWards,
  type CatalogDoctor,
  type CatalogDepartment,
  type CatalogWard,
} from "@/lib/catalog";
import type { Role } from "@/lib/roles";

const inputClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

const KPI_ICONS: Record<string, LucideIcon> = {
  patients: Users,
  appointments: CalendarDays,
  revenue: Banknote,
  invoices: Receipt,
  payments: Banknote,
  claims: ShieldAlert,
  lab: FlaskConical,
  pharmacy: Pill,
  ipd: BedDouble,
  radiology: ScanLine,
  followups: CalendarClock,
  staff: UserCog,
  void: ShieldAlert,
  audit: Activity,
};

type PaymentMethodOption = {
  id: string;
  methodName: string;
  methodCode: string;
  isActive: boolean;
};

function iconForKey(key: string): LucideIcon {
  const prefix = key.split(".")[0];
  return KPI_ICONS[prefix] ?? BarChart3;
}

function formatUpdated(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

function formatCell(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return Number(value).toLocaleString();
  return String(value);
}

/** Prefer overlay for billed+collected; otherwise stack up to 4 series cards. */
function seriesChartBlocks(seriesList: AnalyticsSeries[]) {
  const list = seriesList.slice(0, 4);
  const billed = list.find((s) => /billed/i.test(s.key));
  const collected = list.find((s) => /collected/i.test(s.key));
  if (billed && collected) {
    const rest = list.filter((s) => s !== billed && s !== collected);
    return [
      { kind: "overlay" as const, items: [billed, collected] },
      ...rest.map((s) => ({ kind: "single" as const, items: [s] })),
    ];
  }
  return list.map((s) => ({ kind: "single" as const, items: [s] }));
}

function seriesHasPrevious(s: AnalyticsSeries) {
  return s.points.some(
    (p) => p.previousValue !== null && p.previousValue !== undefined,
  );
}

export default function ReportsAnalyticsPage() {
  const { user } = useAuth();
  const role = (user?.role ?? "ADMIN") as Role;
  const tabs = useMemo(() => tabsForRole(role), [role]);

  const [tab, setTab] = useState<AnalyticsDomain>(
    () => tabs[0]?.id ?? "overview",
  );
  const [preset, setPreset] = useState<AnalyticsPreset>("last_30_days");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [compare, setCompare] = useState<AnalyticsFilters["compare"]>(
    "previous_period",
  );
  const [granularity, setGranularity] =
    useState<AnalyticsFilters["granularity"]>("day");
  const [status, setStatus] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [wardId, setWardId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>(
    [],
  );

  const { data: doctors } = useDoctors();
  const { data: wards } = useWards();
  const { data: departments } = useDepartments();

  useEffect(() => {
    if (!tabs.find((t) => t.id === tab) && tabs[0]) {
      setTab(tabs[0].id);
    }
  }, [tabs, tab]);

  const activeTab = tabs.find((t) => t.id === tab) ?? tabs[0];
  const tabFilters = activeTab?.filters ?? [];

  useEffect(() => {
    if (!tabFilters.includes("paymentMethod")) return;
    void api<PaymentMethodOption[]>("/billing/payment-methods?active=true")
      .then(setPaymentMethods)
      .catch(() => setPaymentMethods([]));
  }, [tabFilters]);

  useEffect(() => {
    setDoctorId("");
    setWardId("");
    setDepartmentId("");
    setPaymentMethodId("");
    setStatus("");
  }, [tab]);

  const filters = useMemo<AnalyticsFilters>(
    () => ({
      preset,
      from: preset === "custom" ? from || undefined : undefined,
      to: preset === "custom" ? to || undefined : undefined,
      compare,
      granularity,
      status: status || undefined,
      doctorId: doctorId || undefined,
      wardId: wardId || undefined,
      departmentId: departmentId || undefined,
      paymentMethodId: paymentMethodId || undefined,
    }),
    [
      preset,
      from,
      to,
      compare,
      granularity,
      status,
      doctorId,
      wardId,
      departmentId,
      paymentMethodId,
    ],
  );

  const load = useCallback(async () => {
    if (!activeTab) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchAnalytics(activeTab.id, filters);
      setPayload(data);
    } catch (err) {
      setPayload(null);
      setError(
        err instanceof Error ? err.message : "Unable to load this report.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const onExport = async () => {
    if (!activeTab) return;
    setExportBusy(true);
    try {
      await exportAnalytics(activeTab.id, filters, "csv");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <RoleGuard module="reports">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Live operational intelligence from hospital records — not estimates."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <OutlineButton onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </OutlineButton>
            <PrimaryButton onClick={() => void onExport()} disabled={exportBusy}>
              <Download className="h-3.5 w-3.5" />
              {exportBusy ? "Exporting…" : "Export"}
            </PrimaryButton>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-100 bg-white p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Date range
          <select
            className={inputClass}
            value={preset}
            onChange={(e) => setPreset(e.target.value as AnalyticsPreset)}
          >
            {PRESET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {preset === "custom" && (
          <>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              From
              <input
                type="date"
                className={inputClass}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              To
              <input
                type="date"
                className={inputClass}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </>
        )}
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Comparison
          <select
            className={inputClass}
            value={compare}
            onChange={(e) =>
              setCompare(e.target.value as AnalyticsFilters["compare"])
            }
          >
            <option value="previous_period">Previous period</option>
            <option value="previous_month">Previous month</option>
            <option value="previous_year">Previous year</option>
            <option value="none">None</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Granularity
          <select
            className={inputClass}
            value={granularity}
            onChange={(e) =>
              setGranularity(e.target.value as AnalyticsFilters["granularity"])
            }
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
            <option value="quarter">Quarterly</option>
            <option value="year">Yearly</option>
          </select>
        </label>
        {tabFilters.includes("status") && (
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Status
            <input
              className={inputClass}
              placeholder="Optional filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </label>
        )}
        {tabFilters.includes("doctor") && (
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Doctor
            <select
              className={inputClass}
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
            >
              <option value="">All doctors</option>
              {(doctors as CatalogDoctor[]).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {tabFilters.includes("ward") && (
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Ward
            <select
              className={inputClass}
              value={wardId}
              onChange={(e) => setWardId(e.target.value)}
            >
              <option value="">All wards</option>
              {(wards as CatalogWard[]).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {tabFilters.includes("department") && (
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Department
            <select
              className={inputClass}
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">All departments</option>
              {(departments as CatalogDepartment[]).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {tabFilters.includes("paymentMethod") && (
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Payment method
            <select
              className={inputClass}
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
            >
              <option value="">All methods</option>
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.methodName}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="ml-auto text-xs text-slate-400">
          {payload?.meta.generatedAt
            ? `Last updated: ${formatUpdated(payload.meta.generatedAt)}`
            : loading
              ? "Updating…"
              : null}
          {payload?.meta.compareFrom && payload.meta.compareTo ? (
            <span className="mt-1 block">
              vs {payload.meta.compareFrom} → {payload.meta.compareTo}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-100 pb-px">
        {tabs.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-t-xl px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </p>
      )}

      {!activeTab ? (
        <p className="text-sm text-slate-500">
          No analytics tabs are available for your role.
        </p>
      ) : (
        <DomainPanel
          key={tab}
          loading={loading}
          payload={payload}
          domainLabel={activeTab.label}
        />
      )}
    </RoleGuard>
  );
}

function DomainPanel({
  loading,
  payload,
  domainLabel,
}: {
  loading: boolean;
  payload: AnalyticsPayload | null;
  domainLabel: string;
}) {
  if (loading && !payload) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
      </div>
    );
  }

  if (!payload) {
    return (
      <Card className="p-8 text-center text-sm text-slate-500">
        Unable to load {domainLabel} analytics.
      </Card>
    );
  }

  const kpis = payload.kpis;
  const seriesBlocks = seriesChartBlocks(payload.series);
  const breakdowns = payload.breakdowns.slice(0, 4);
  const noCharts =
    payload.series.every((s) => !s.hasData) &&
    payload.breakdowns.every((b) => !b.hasData);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: Math.max(kpis.length, 4) }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))
          : kpis.map((k) => {
              const down =
                typeof k.changePercent === "number" && k.changePercent < 0;
              const delta =
                k.changePercent === null || k.changePercent === undefined
                  ? k.previousValue === 0 && k.value > 0
                    ? "n/a"
                    : undefined
                  : `${k.changePercent > 0 ? "↑" : k.changePercent < 0 ? "↓" : ""} ${Math.abs(k.changePercent)}%`;
              return (
                <StatCard
                  key={k.key}
                  label={k.label}
                  value={formatMetricValue(k.value, k.unit)}
                  delta={delta}
                  deltaLabel={
                    delta
                      ? "vs previous period"
                      : k.definition.slice(0, 48) +
                        (k.definition.length > 48 ? "…" : "")
                  }
                  down={down}
                  icon={iconForKey(k.key)}
                />
              );
            })}
      </div>

      {noCharts ? (
        <Card className="p-8 text-center text-sm text-slate-400">
          No chart data available for this period.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {seriesBlocks.map((block) => {
            if (block.kind === "overlay") {
              const [a, b] = block.items;
              const periods = a.points.map((p) => p.period);
              const data = periods.map((period, i) => ({
                period,
                [a.key]: a.points[i]?.value ?? 0,
                [b.key]: b.points[i]?.value ?? 0,
              }));
              const empty =
                !a.hasData && !b.hasData
                  ? "No data available for this period."
                  : undefined;
              return (
                <Card key={`${a.key}+${b.key}`} className="p-4">
                  <CardHeader
                    title={`${a.label} vs ${b.label}`}
                    subtitle={`${payload.meta.from} → ${payload.meta.to}`}
                  />
                  <AnalyticsLineChart
                    data={data}
                    lines={[
                      { dataKey: a.key, name: a.label, stroke: "#f02878" },
                      { dataKey: b.key, name: b.label, stroke: "#0d9488" },
                    ]}
                    emptyLabel={empty}
                  />
                </Card>
              );
            }

            const s = block.items[0];
            const showPrev = seriesHasPrevious(s);
            return (
              <Card key={s.key} className="p-4">
                <CardHeader
                  title={s.label}
                  subtitle={`${payload.meta.from} → ${payload.meta.to}`}
                />
                <AnalyticsLineChart
                  data={s.points.map((p) => ({
                    period: p.period,
                    value: p.value,
                    previous: p.previousValue ?? null,
                  }))}
                  previousKey={showPrev ? "previous" : undefined}
                  emptyLabel={
                    s.hasData
                      ? undefined
                      : "No data available for this period."
                  }
                />
              </Card>
            );
          })}

          {breakdowns.map((b) => (
            <BreakdownChart key={b.key} breakdown={b} />
          ))}
        </div>
      )}

      {payload.tables.map((t) => (
        <AnalyticsTableCard key={t.key} table={t} />
      ))}

      <details className="rounded-xl border border-slate-100 bg-white p-4 text-xs text-slate-500">
        <summary className="cursor-pointer font-medium text-slate-700">
          Metric definitions
        </summary>
        <ul className="mt-3 space-y-2">
          {kpis.map((k) => (
            <li key={k.key}>
              <span className="font-semibold text-slate-700">{k.label}:</span>{" "}
              {k.definition}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function BreakdownChart({ breakdown }: { breakdown: AnalyticsBreakdown }) {
  const useDonut = breakdown.rows.length <= 8;
  return (
    <Card className="p-4">
      <CardHeader title={breakdown.label} />
      {useDonut ? (
        <AnalyticsDonutChart
          data={breakdown.rows.map((r) => ({
            name: r.name,
            value: r.value,
          }))}
          emptyLabel={
            breakdown.hasData
              ? undefined
              : "No data available for this period."
          }
        />
      ) : (
        <AnalyticsBarChart
          data={breakdown.rows.slice(0, 12).map((r) => ({
            name: r.name.length > 14 ? `${r.name.slice(0, 12)}…` : r.name,
            value: r.value,
          }))}
          emptyLabel={
            breakdown.hasData
              ? undefined
              : "No data available for this period."
          }
        />
      )}
    </Card>
  );
}

function AnalyticsTableCard({ table }: { table: AnalyticsTable }) {
  const previewCols = table.columns.slice(0, 3);

  return (
    <Card className="p-4">
      <CardHeader title={table.label} subtitle="Exact values behind the charts" />
      {!table.hasData ? (
        <p className="px-2 py-8 text-center text-sm text-slate-400">
          No data available for this period.
        </p>
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {table.rows.map((row, idx) => (
              <li
                key={idx}
                className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm"
              >
                {previewCols.map((c) => (
                  <div
                    key={c}
                    className="flex items-baseline justify-between gap-3 py-0.5"
                  >
                    <span className="text-xs text-slate-400">{c}</span>
                    <span className="min-w-0 truncate font-medium text-slate-800">
                      {formatCell(row[c])}
                    </span>
                  </div>
                ))}
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <Table headers={table.columns}>
              {table.rows.map((row, idx) => (
                <tr key={idx}>
                  {table.columns.map((c) => (
                    <td key={c} className={cell}>
                      {formatCell(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </Table>
          </div>
        </>
      )}
    </Card>
  );
}
