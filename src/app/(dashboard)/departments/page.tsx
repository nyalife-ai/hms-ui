"use client";

import { Building2, Search, Stethoscope, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { PaginationBar } from "@/components/pagination-bar";
import { RoleGuard } from "@/components/role-guard";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { DeptStaffChart } from "@/components/charts";
import { usePaginatedCatalog, type CatalogDepartment } from "@/lib/catalog";
import { toPageMeta } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

export default function DepartmentsPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const params = useMemo(
    () => ({
      page,
      limit: 50,
      search: search || undefined,
    }),
    [page, search],
  );
  const { items: departments, total, limit, loading, error } =
    usePaginatedCatalog<CatalogDepartment>("/catalog/departments", params);

  const totalStaff = departments.reduce((sum, d) => sum + d.staff, 0);
  const avg =
    departments.length > 0 ? Math.round(totalStaff / departments.length) : 0;
  const meta = toPageMeta({ total, page, limit });

  return (
    <RoleGuard module="departments">
      <PageHeader
        title="Departments"
        subtitle={
          loading
            ? "Loading departments…"
            : `${total.toLocaleString()} clinical and support units`
        }
      />

      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-1">
          {[
            {
              label: "Total Departments",
              value: String(total),
              note: `${totalStaff} staff on this page`,
              icon: Building2,
            },
            {
              label: "Total Specialties",
              value: String(departments.length),
              note: "shown on this page",
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
                <p className="text-sm text-foreground-light">{stat.label}</p>
                <p className="mt-1.5 text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="mt-1 text-xs text-foreground-lighter">{stat.note}</p>
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
            subtitle={`Staff on page ${totalStaff}`}
            action={
              <div className="flex items-center gap-3 text-[11px] text-foreground-lighter">
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
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-lighter" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
          placeholder="Search Departments"
          className="w-full rounded-full border border-border bg-white py-2.5 pl-11 pr-4 text-sm text-foreground placeholder:text-foreground-lighter focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {departments.map((dept) => (
          <Card key={dept.id} className="overflow-hidden">
            <div className="flex h-32 items-center justify-center bg-brand-100">
              <Building2 className="h-10 w-10 text-brand-500/70" />
            </div>
            <div className="p-4">
              <h3 className="text-sm font-bold text-foreground">{dept.name}</h3>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="truncate rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700">
                  {dept.location}
                </span>
                <span className="shrink-0 text-xs font-medium text-foreground-light">
                  {dept.staff} Staff
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-foreground-lighter">
                {dept.description.replace(/^[^\n]+\n/, "")}
              </p>
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-border bg-white">
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </div>
    </RoleGuard>
  );
}
