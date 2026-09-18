"use client";

import { Building2, Pencil, Plus, Search, Stethoscope, UsersRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import { FieldLabel } from "@/components/field-label";
import { PaginationBar } from "@/components/pagination-bar";
import { RoleGuard } from "@/components/role-guard";
import { Card, CardHeader, PageHeader, PrimaryButton } from "@/components/ui";
import { DeptStaffChart } from "@/components/charts";
import { api } from "@/lib/api";
import { usePaginatedCatalog, type CatalogDepartment } from "@/lib/catalog";
import { toPageMeta } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

const DEPARTMENT_TYPES = ["CLINICAL", "ADMINISTRATIVE", "SUPPORT"] as const;

type DepartmentDetail = {
  id: string;
  name: string;
  code?: string;
  type?: (typeof DEPARTMENT_TYPES)[number];
  description?: string;
  headName?: string;
  headPosition?: string;
  isActive?: boolean;
};

type DepartmentFormValues = {
  name: string;
  code: string;
  type: (typeof DEPARTMENT_TYPES)[number];
  description: string;
  headName: string;
  headPosition: string;
  isActive: boolean;
};

const EMPTY_FORM: DepartmentFormValues = {
  name: "",
  code: "",
  type: "CLINICAL",
  description: "",
  headName: "",
  headPosition: "",
  isActive: true,
};

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
  const { items: departments, total, limit, loading, error, refresh } =
    usePaginatedCatalog<CatalogDepartment>("/catalog/departments", params);

  const totalStaff = departments.reduce((sum, d) => sum + d.staff, 0);
  const avg =
    departments.length > 0 ? Math.round(totalStaff / departments.length) : 0;
  const meta = toPageMeta({ total, page, limit });

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DepartmentFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [formError, setFormError] = useState("");

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  };

  const openEdit = async (dept: CatalogDepartment) => {
    setEditingId(dept.id);
    setFormError("");
    setShowModal(true);
    setLoadingDetail(true);
    try {
      const detail = await api<DepartmentDetail>(`/departments/${dept.id}`);
      setForm({
        name: detail.name ?? dept.name,
        code: detail.code ?? dept.code ?? "",
        type: detail.type ?? "CLINICAL",
        description: detail.description ?? "",
        headName: detail.headName ?? dept.headName ?? "",
        headPosition: detail.headPosition ?? "",
        isActive: detail.isActive ?? true,
      });
    } catch {
      // Fall back to the catalog projection's partial data if the detail fetch fails.
      setForm({
        ...EMPTY_FORM,
        name: dept.name,
        code: dept.code,
        description: dept.description,
        headName: dept.headName ?? "",
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  const submitDepartment = async () => {
    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    const body = {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      type: form.type,
      description: form.description.trim() || undefined,
      headName: form.headName.trim() || undefined,
      headPosition: form.headPosition.trim() || undefined,
      isActive: form.isActive,
    };
    try {
      if (editingId) {
        await api(`/departments/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await api("/departments", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      setShowModal(false);
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save department");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard module="departments">
      <PageHeader
        title="Departments"
        subtitle={
          loading
            ? "Loading departments…"
            : `${total.toLocaleString()} clinical and support units`
        }
        action={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" />
            New department
          </button>
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
          className="w-full rounded-full border border-border bg-surface py-2.5 pl-11 pr-4 text-sm text-foreground placeholder:text-foreground-lighter focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {departments.map((dept) => (
          <Card key={dept.id} className="overflow-hidden">
            <div className="flex h-32 items-center justify-center bg-brand-100">
              <Building2 className="h-10 w-10 text-brand-500/70" />
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-foreground">{dept.name}</h3>
                <button
                  type="button"
                  onClick={() => void openEdit(dept)}
                  className="shrink-0 rounded-lg p-1 text-foreground-lighter hover:bg-surface-200 hover:text-foreground-light"
                  aria-label={`Edit ${dept.name}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
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
      <div className="mt-4 rounded-2xl border border-border bg-surface">
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl bg-surface p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">
                {editingId ? "Edit department" : "New department"}
              </h2>
              <button type="button" onClick={() => setShowModal(false)}>
                <X className="h-4 w-4 text-foreground-lighter" />
              </button>
            </div>

            {loadingDetail ? (
              <p className="text-sm text-foreground-lighter">Loading…</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <FieldLabel required>Name</FieldLabel>
                  <input
                    className={inputClass}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel optional>Code</FieldLabel>
                    <input
                      className={inputClass}
                      placeholder="Auto-generated if blank"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                    />
                  </div>
                  <div>
                    <FieldLabel optional>Type</FieldLabel>
                    <select
                      className={inputClass}
                      value={form.type}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          type: e.target.value as DepartmentFormValues["type"],
                        })
                      }
                    >
                      {DEPARTMENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <FieldLabel optional>Description</FieldLabel>
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel optional>Head of department</FieldLabel>
                    <input
                      className={inputClass}
                      value={form.headName}
                      onChange={(e) => setForm({ ...form, headName: e.target.value })}
                    />
                  </div>
                  <div>
                    <FieldLabel optional>Head's title</FieldLabel>
                    <input
                      className={inputClass}
                      value={form.headPosition}
                      onChange={(e) => setForm({ ...form, headPosition: e.target.value })}
                    />
                  </div>
                </div>
                {editingId && (
                  <label className="flex items-center gap-2 text-sm text-foreground-light">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    />
                    Active
                  </label>
                )}
                {formError && <p className="text-sm text-rose-600">{formError}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground-light hover:border-brand-300"
                  >
                    Cancel
                  </button>
                  <PrimaryButton onClick={() => void submitDepartment()} disabled={saving}>
                    {saving ? "Saving…" : editingId ? "Save changes" : "Create department"}
                  </PrimaryButton>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
