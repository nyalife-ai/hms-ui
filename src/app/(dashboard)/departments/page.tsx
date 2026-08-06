"use client";

import { Building2, Search, Stethoscope, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { DeptStaffChart } from "@/components/charts";
import { useDepartments } from "@/lib/catalog";

export default function DepartmentsPage() {
  const { data: departments, loading, error } = useDepartments();
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      departments.filter((d) =>
        d.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [departments, query],
  );
  const totalStaff = departments.reduce((sum, d) => sum + d.staff, 0);
  const avg =
    departments.length > 0 ? Math.round(totalStaff / departments.length) : 0;

  return (
    <RoleGuard module="departments">
      <PageHeader
        title="Departments"
        subtitle={
          loading
            ? "Loading departments…"
            : "Clinical and support units across the hospital"
        }
      />

      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-1">
          {[
            {
              label: "Total Departments",
              value: String(departments.length),
              note: `with ${totalStaff} staff in total`,
              icon: Building2,
            },
            {
              label: "Total Specialties",
              value: String(departments.length),
              note: "active clinical units",
              icon: Stethoscope,
            },
            {
              label: "Average Team per Dept",
              value: String(avg),
              note: "from staff assignments",
              icon: UsersRound,
            },
          ].map((stat) => (
            <Card key={stat.label} className="flex items-start justify-between p-5">
              <div>
                <p className="text-sm text-slate-500">{stat.label}</p>
                <p className="mt-1.5 text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="mt-1 text-xs text-slate-400">{stat.note}</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-800 text-white">
                <stat.icon className="h-4 w-4" />
              </span>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader
            title="Staff Breakdown by Departments"
            subtitle={`Total All Staff ${totalStaff}`}
            action={
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-brand-100" /> Support
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-brand-300" /> Specialists
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-brand-500" /> Nurses
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-brand-800" /> Doctors
                </span>
              </div>
            }
          />
          <div className="px-3 pb-3">
            <DeptStaffChart departments={departments} />
          </div>
        </Card>
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Departments"
          className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {filtered.map((dept) => (
          <Card key={dept.id} className="overflow-hidden">
            <div className="flex h-32 items-center justify-center bg-brand-100">
              <Building2 className="h-10 w-10 text-brand-500/70" />
            </div>
            <div className="p-4">
              <h3 className="text-sm font-bold text-slate-900">{dept.name}</h3>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="truncate rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700">
                  {dept.location}
                </span>
                <span className="shrink-0 text-xs font-medium text-slate-500">
                  {dept.staff} Staff
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                {dept.description.replace(/^[^\n]+\n/, "")}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </RoleGuard>
  );
}
