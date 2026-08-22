"use client";

import { Pencil, Plus, ShieldCheck, UserX, X } from "lucide-react";
import { useMemo, useState } from "react";
import { BulkImportButton } from "@/components/bulk-import-button";
import { FieldLabel } from "@/components/field-label";
import { PaginationBar } from "@/components/pagination-bar";
import { RoleGuard } from "@/components/role-guard";
import { TableAction } from "@/components/table-action";
import { Avatar, Badge, Card, CardHeader, PageHeader, PrimaryButton, Table } from "@/components/ui";
import { api } from "@/lib/api";
import {
  useDepartments,
  usePaginatedCatalog,
  type CatalogStaff,
} from "@/lib/catalog";
import { toPageMeta } from "@/lib/pagination";
import { MODULE_ACCESS, ROLE_LABELS, type Role } from "@/lib/roles";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

const STAFF_ROLES = [
  "DOCTOR",
  "NURSE",
  "RECEPTIONIST",
  "PHARMACIST",
  "LAB_TECHNICIAN",
  "RADIOLOGIST",
  "ACCOUNTANT",
];

export default function StaffPage() {
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
  const { items: staff, total, limit, loading, error, refresh } =
    usePaginatedCatalog<CatalogStaff>("/catalog/staff", params);
  const { data: departments } = useDepartments();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<CatalogStaff | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("NURSE");
  const [departmentId, setDepartmentId] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editDeptId, setEditDeptId] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [actionId, setActionId] = useState("");

  const deactivate = async (id: string) => {
    if (!window.confirm("Deactivate this staff member? They will lose login access.")) return;
    setActionId(id);
    try {
      await api(`/ops/staff/${id}`, { method: "DELETE" });
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not deactivate");
    } finally {
      setActionId("");
    }
  };

  const openEdit = (s: CatalogStaff) => {
    setEdit(s);
    const base = s.name.replace(/^Dr\.\s*/, "").trim();
    const parts = base.split(/\s+/);
    setEditFirstName(parts[0] ?? "");
    setEditLastName(parts.slice(1).join(" ") || "");
    setEditPosition("");
    const match = departments.find((d) => d.name === s.department);
    setEditDeptId(match?.id ?? "");
    setFormError("");
  };

  const saveEdit = async () => {
    if (!edit) return;
    if (!editFirstName.trim() || !editLastName.trim()) {
      setFormError("First and last name are required.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api(`/ops/staff/${edit.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          departmentId: editDeptId || null,
          position: editPosition.trim() || undefined,
        }),
      });
      setEdit(null);
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to save changes");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!firstName || !lastName || !email) {
      setFormError("Name and email are required.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api("/ops/staff", {
        method: "POST",
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone: phone || undefined,
          role,
          departmentId: departmentId || undefined,
          asDoctor: role === "DOCTOR",
        }),
      });
      setOpen(false);
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to create staff member");
    } finally {
      setBusy(false);
    }
  };

  const meta = toPageMeta({ total, page, limit });

  return (
    <RoleGuard module="staff">
      <PageHeader
        title="Staff & Roles"
        subtitle={
          loading ? "Loading…" : `${total.toLocaleString()} employees · role-based access`
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <BulkImportButton
              resource="doctors"
              title="Import staff"
              description="Download the template, fill staff details (no passwords), then review before importing."
              label="Import staff"
              onImported={refresh}
            />
            <PrimaryButton onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Add staff member
            </PrimaryButton>
          </div>
        }
      />
      <div className="space-y-6">
        <div className="mb-4">
          <input
            className={inputClass}
            placeholder="Search name, employee ID, role…"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Card>
          <CardHeader
            title="Staff directory"
            subtitle={loading ? "Loading…" : `${total.toLocaleString()} employees`}
          />
          {error && <p className="px-5 text-sm text-rose-500">{error}</p>}
          {formError && !open && !edit && (
            <p className="px-5 text-sm text-rose-500">{formError}</p>
          )}
          <Table headers={["Name", "Employee ID", "Role", "Department", "Status", ""]}>
            {staff.map((s) => (
              <tr key={s.id} className="transition hover:bg-slate-50/60">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} size="sm" />
                    <span className="font-medium text-slate-800">{s.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-slate-500">{s.employeeId}</td>
                <td className="px-5 py-3.5 text-slate-500">{s.role}</td>
                <td className="px-5 py-3.5 text-slate-500">{s.department}</td>
                <td className="px-5 py-3.5">
                  <Badge tone={s.status === "Active" ? "green" : "amber"}>{s.status}</Badge>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1">
                    <TableAction
                      icon={Pencil}
                      label="Edit staff"
                      tone="edit"
                      onClick={() => openEdit(s)}
                    />
                    {s.status === "Active" && (
                      <TableAction
                        icon={UserX}
                        label="Deactivate"
                        tone="danger"
                        disabled={actionId === s.id}
                        onClick={() => void deactivate(s.id)}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          {loading && (
            <div className="space-y-2 px-4 py-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          )}
          <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
        </Card>

        <Card>
          <CardHeader
            title="Role access matrix"
            subtitle="Which modules each role can open"
            action={
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <ShieldCheck className="h-4 w-4" />
              </span>
            }
          />
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-4 font-medium">Module</th>
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                    <th key={r} className="px-2 py-2 text-center font-medium">
                      {ROLE_LABELS[r].split(" ")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {Object.entries(MODULE_ACCESS).map(([module, roles]) => (
                  <tr key={module}>
                    <td className="py-2.5 pr-4 font-medium capitalize text-slate-700">{module}</td>
                    {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                      <td key={r} className="px-2 py-2.5 text-center">
                        {roles.includes(r) ? (
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-500" />
                        ) : (
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-200" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Add staff member</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel required>First name</FieldLabel>
                  <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <FieldLabel required>Last name</FieldLabel>
                  <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div>
                <FieldLabel required>Email</FieldLabel>
                <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <FieldLabel optional>Phone</FieldLabel>
                <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <FieldLabel required>Role</FieldLabel>
                <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel optional>Department</FieldLabel>
                <select className={inputClass} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              {formError && <p className="text-sm text-rose-500">{formError}</p>}
              <PrimaryButton disabled={busy} onClick={submit}>
                {busy ? "Saving…" : "Create staff"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Edit staff · {edit.employeeId}
              </h2>
              <button onClick={() => setEdit(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel required>First name</FieldLabel>
                  <input
                    className={inputClass}
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel required>Last name</FieldLabel>
                  <input
                    className={inputClass}
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <FieldLabel optional>Department</FieldLabel>
                <select className={inputClass} value={editDeptId} onChange={(e) => setEditDeptId(e.target.value)}>
                  <option value="">No department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel optional>Position</FieldLabel>
                <input
                  className={inputClass}
                  value={editPosition}
                  onChange={(e) => setEditPosition(e.target.value)}
                  placeholder="e.g. Senior nurse"
                />
              </div>
              {formError && <p className="text-sm text-rose-500">{formError}</p>}
              <PrimaryButton disabled={busy} onClick={saveEdit}>
                {busy ? "Saving…" : "Save changes"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
