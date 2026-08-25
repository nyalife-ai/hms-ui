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
import { useAuth } from "@/lib/auth";
import {
  type AnalyticsDomain,
  type AnalyticsFilters,
  type AnalyticsPayload,
  type AnalyticsPreset,
  PRESET_OPTIONS,
  exportAnalytics,
  fetchAnalytics,
  formatMetricValue,
  tabsForRole,
} from "@/lib/analytics";
import type { Role } from "@/lib/roles";

const inputClass =
  "rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

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
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportBusy, setExportBusy] = useState(false);

  useEffect(() => {
    if (!tabs.find((t) => t.id === tab) && tabs[0]) {
      setTab(tabs[0].id);
    }
  }, [tabs, tab]);

  const activeTab = tabs.find((t) => t.id === tab) ?? tabs[0];
  const filters = useMemo<AnalyticsFilters>(
    () => ({
      preset,
      from: preset === "custom" ? from || undefined : undefined,
      to: preset === "custom" ? to || undefined : undefined,
      compare,
      granularity,
      status: status || undefined,
    }),
    [preset, from, to, compare, granularity, status],
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

  const showStatus = activeTab?.filters.includes("status");

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

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-white p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-foreground-light">
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
            <label className="flex flex-col gap-1 text-xs font-medium text-foreground-light">
              From
              <input
                type="date"
                className={inputClass}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-foreground-light">
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
        <label className="flex flex-col gap-1 text-xs font-medium text-foreground-light">
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
        <label className="flex flex-col gap-1 text-xs font-medium text-foreground-light">
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
        {showStatus && (
          <label className="flex flex-col gap-1 text-xs font-medium text-foreground-light">
            Status
            <input
              className={inputClass}
              placeholder="Optional filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </label>
        )}
        <div className="ml-auto text-xs text-foreground-lighter">
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

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border pb-px">
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
                  : "text-foreground-light hover:bg-surface-200 hover:text-foreground"
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
        <p className="text-sm text-foreground-light">
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
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-surface-200" />
      </div>
    );
  }

  if (!payload) {
    return (
      <Card className="p-8 text-center text-sm text-foreground-light">
        Unable to load {domainLabel} analytics.
      </Card>
    );
  }

  const kpis = payload.kpis;
  const primarySeries = payload.series[0];
  const secondarySeries = payload.series[1];
  const donut = payload.breakdowns.find((b) => b.rows.length <= 8);
  const bar = payload.breakdowns.find((b) => b !== donut) ?? payload.breakdowns[0];

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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {primarySeries && (
          <Card className="p-4">
            <CardHeader
              title={primarySeries.label}
              subtitle={`${payload.meta.from} → ${payload.meta.to}`}
            />
            <AnalyticsLineChart
              data={primarySeries.points.map((p) => ({
                period: p.period,
                value: p.value,
                previous: p.previousValue ?? null,
              }))}
              emptyLabel={
                primarySeries.hasData
                  ? undefined
                  : "No data available for this period."
              }
            />
          </Card>
        )}
        {secondarySeries && (
          <Card className="p-4">
            <CardHeader title={secondarySeries.label} />
            <AnalyticsLineChart
              data={secondarySeries.points.map((p) => ({
                period: p.period,
                value: p.value,
              }))}
              emptyLabel={
                secondarySeries.hasData
                  ? undefined
                  : "No data available for this period."
              }
            />
          </Card>
        )}
        {donut && (
          <Card className="p-4">
            <CardHeader title={donut.label} />
            <AnalyticsDonutChart
              data={donut.rows.map((r) => ({
                name: r.name,
                value: r.value,
              }))}
              emptyLabel={
                donut.hasData ? undefined : "No data available for this period."
              }
            />
          </Card>
        )}
        {bar && bar !== donut && (
          <Card className="p-4">
            <CardHeader title={bar.label} />
            <AnalyticsBarChart
              data={bar.rows.slice(0, 12).map((r) => ({
                name: r.name.length > 14 ? `${r.name.slice(0, 12)}…` : r.name,
                value: r.value,
              }))}
              emptyLabel={
                bar.hasData ? undefined : "No data available for this period."
              }
            />
          </Card>
        )}
      </div>

      {payload.tables.map((t) => (
        <Card key={t.key} className="p-4">
          <CardHeader title={t.label} subtitle="Exact values behind the charts" />
          {!t.hasData ? (
            <p className="px-2 py-8 text-center text-sm text-foreground-lighter">
              No data available for this period.
            </p>
          ) : (
            <Table headers={t.columns}>
              {t.rows.map((row, idx) => (
                <tr key={idx}>
                  {t.columns.map((c) => (
                    <td key={c} className={cell}>
                      {row[c] === null || row[c] === undefined
                        ? "—"
                        : typeof row[c] === "number"
                          ? Number(row[c]).toLocaleString()
                          : String(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </Table>
          )}
        </Card>
      ))}

      <details className="rounded-xl border border-border bg-white p-4 text-xs text-foreground-light">
        <summary className="cursor-pointer font-medium text-foreground">
          Metric definitions
        </summary>
        <ul className="mt-3 space-y-2">
          {kpis.map((k) => (
            <li key={k.key}>
              <span className="font-semibold text-foreground">{k.label}:</span>{" "}
              {k.definition}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
