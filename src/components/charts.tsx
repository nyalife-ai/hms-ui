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

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 12px rgba(23,40,46,0.08)",
  fontSize: 12,
};

const axisTick = { fontSize: 11, fill: "#94a3b8" };

export function AgeStagesChart({
  data = [],
}: {
  data?: Array<{ name: string; value: number }>;
}) {
  if (!data.length || data.every((d) => d.value === 0)) {
    return (
      <p className="px-4 py-16 text-center text-sm text-slate-400">
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
      <p className="px-4 py-16 text-center text-sm text-slate-400">
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
        <span className="text-xs text-slate-400">Appointments</span>
        <span className="text-xl font-bold text-slate-900">{total.toLocaleString()}</span>
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
      <p className="px-4 py-16 text-center text-sm text-slate-400">
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
      <p className="px-4 py-16 text-center text-sm text-slate-400">
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
      <p className="px-4 py-12 text-center text-sm text-slate-400">
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
