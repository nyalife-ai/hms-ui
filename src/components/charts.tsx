"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 12px rgba(23,40,46,0.08)",
  fontSize: 12,
};

const axisTick = { fontSize: 11, fill: "#94a3b8" };

export function ChartEmptyState({
  title = "No data available",
  description = "There is no data for the selected period.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-200 text-foreground-lighter">
        <BarChart3 className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-foreground-lighter">{description}</p>
    </div>
  );
}

export function AgeStagesChart({
  data = [],
}: {
  data?: Array<{ name: string; value: number }>;
}) {
  if (!data.length || data.every((d) => d.value === 0)) {
    return (
      <p className="px-4 py-16 text-center text-sm text-foreground-lighter">
        No patient age data yet.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f2" vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axisTick} />
        <YAxis tickLine={false} axisLine={false} tick={axisTick} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#fff1f6" }} />
        <Bar dataKey="value" name="Patients" fill="#f02878" radius={[4, 4, 4, 4]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DepartmentsDonut({
  data = [],
}: {
  data?: Array<{ name: string; value: number; color: string }>;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (!data.length || total === 0) {
    return (
      <p className="px-4 py-16 text-center text-sm text-foreground-lighter">
        No department volume yet.
      </p>
    );
  }
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => `${Number(v).toLocaleString()} visits`}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={62}
            outerRadius={88}
            paddingAngle={2}
            cornerRadius={4}
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-foreground-lighter">Appointments</span>
        <span className="text-xl font-bold text-foreground">{total.toLocaleString()}</span>
      </div>
    </div>
  );
}

export function RevenueLineChart({
  data = [],
}: {
  data?: Array<{ date: string; amount: number }>;
}) {
  if (!data.length) {
    return (
      <p className="px-4 py-16 text-center text-sm text-foreground-lighter">
        No invoice revenue recorded yet.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={230}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f2" vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={axisTick} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={axisTick}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${v}`
          }
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => `KES ${Number(v).toLocaleString()}`}
        />
        <Line
          type="monotone"
          dataKey="amount"
          name="Revenue"
          stroke="#1aa8b0"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: "#f02878" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DeptStaffChart({
  departments = [],
}: {
  departments?: Array<{
    name: string;
    doctors: number;
    nurses: number;
    specialists: number;
    support: number;
  }>;
}) {
  const data = departments.map((d) => ({
    name: d.name.split(" ")[0],
    Doctors: d.doctors,
    Nurses: d.nurses,
    Specialists: d.specialists,
    Support: d.support,
  }));
  if (!data.length) {
    return (
      <p className="px-4 py-16 text-center text-sm text-foreground-lighter">
        No department staffing data.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f2" vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axisTick} />
        <YAxis tickLine={false} axisLine={false} tick={axisTick} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="Doctors" stackId="a" fill="#961247" />
        <Bar dataKey="Nurses" stackId="a" fill="#f02878" />
        <Bar dataKey="Specialists" stackId="a" fill="#1aa8b0" />
        <Bar dataKey="Support" stackId="a" fill="#aeeae2" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function InventoryUsageChart({
  data = [],
}: {
  data?: Array<{ date: string; units: number }>;
}) {
  if (!data.length) {
    return (
      <p className="px-4 py-12 text-center text-sm text-foreground-lighter">
        No dispense activity recorded yet.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={190}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f2" vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={axisTick} />
        <YAxis tickLine={false} axisLine={false} tick={axisTick} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line
          type="monotone"
          dataKey="units"
          name="Units"
          stroke="#1aa8b0"
          strokeWidth={2.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

const ANALYTICS_PALETTE = [
  "#f02878",
  "#0d9488",
  "#2563eb",
  "#f59e0b",
  "#8b5cf6",
  "#64748b",
  "#ef4444",
  "#14b8a6",
];

export function AnalyticsLineChart({
  data = [],
  valueKey = "value",
  previousKey,
  lines,
  emptyLabel = "No data available for this period.",
}: {
  data?: Array<Record<string, string | number | null>>;
  valueKey?: string;
  previousKey?: string;
  /** Multiple current-period series overlaid on one chart. */
  lines?: Array<{
    dataKey: string;
    name: string;
    stroke?: string;
    dashed?: boolean;
  }>;
  emptyLabel?: string;
}) {
  const keysToCheck = lines?.length
    ? lines.map((l) => l.dataKey)
    : [valueKey, ...(previousKey ? [previousKey] : [])];
  const hasData = data.some((d) =>
    keysToCheck.some((k) => Number(d[k] ?? 0) !== 0),
  );
  if (!data.length || !hasData) {
    return <ChartEmptyState description={emptyLabel} />;
  }

  const palette = ["#f02878", "#0d9488", "#2563eb", "#f59e0b"];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f2" vertical={false} />
        <XAxis dataKey="period" tickLine={false} axisLine={false} tick={axisTick} />
        <YAxis tickLine={false} axisLine={false} tick={axisTick} />
        <Tooltip contentStyle={tooltipStyle} />
        {lines?.length ? (
          lines.map((line, i) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.name}
              stroke={line.stroke ?? palette[i % palette.length]}
              strokeWidth={2.5}
              strokeDasharray={line.dashed ? "4 4" : undefined}
              dot={false}
            />
          ))
        ) : (
          <>
            <Line
              type="monotone"
              dataKey={valueKey}
              name="Current"
              stroke="#f02878"
              strokeWidth={2.5}
              dot={false}
            />
            {previousKey ? (
              <Line
                type="monotone"
                dataKey={previousKey}
                name="Previous"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            ) : null}
          </>
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AnalyticsBarChart({
  data = [],
  emptyLabel = "No data available for this period.",
}: {
  data?: Array<{ name: string; value: number }>;
  emptyLabel?: string;
}) {
  if (!data.length || data.every((d) => d.value === 0)) {
    return <ChartEmptyState description={emptyLabel} />;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f2" vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axisTick} />
        <YAxis tickLine={false} axisLine={false} tick={axisTick} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="value" fill="#f02878" radius={[4, 4, 4, 4]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AnalyticsDonutChart({
  data = [],
  emptyLabel = "No data available for this period.",
}: {
  data?: Array<{ name: string; value: number }>;
  emptyLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!data.length || total === 0) {
    return <ChartEmptyState description={emptyLabel} />;
  }
  const slice = data.slice(0, 8).map((d, i) => ({
    ...d,
    color: ANALYTICS_PALETTE[i % ANALYTICS_PALETTE.length],
  }));
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-center">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Tooltip contentStyle={tooltipStyle} />
          <Pie
            data={slice}
            dataKey="value"
            nameKey="name"
            innerRadius={58}
            outerRadius={88}
            paddingAngle={2}
            cornerRadius={4}
            strokeWidth={0}
          >
            {slice.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <ul className="space-y-1.5 px-2 text-xs text-foreground-light">
        {slice.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: d.color }}
            />
            <span className="truncate">{d.name}</span>
            <span className="ml-auto font-medium tabular-nums">
              {d.value.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
