"use client";

import { Plus, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import { Avatar, Badge, Card, CardHeader, PageHeader, PrimaryButton, Table } from "@/components/ui";
import { api } from "@/lib/api";
import { useDepartments, useStaffCatalog } from "@/lib/catalog";
import { MODULE_ACCESS, ROLE_LABELS, type Role } from "@/lib/roles";

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
  const { data: staff, loading, error, refresh } = useStaffCatalog();
  const { data: departments } = useDepartments();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("NURSE");
  const [departmentId, setDepartmentId] = useState("");
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
      setFormError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <RoleGuard module="staff">
      <PageHeader
        title="Staff & Roles"
        subtitle="Manage employees and role-based access"
        action={
          <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add staff member
          </PrimaryButton>
        }
      />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Staff directory" subtitle={loading ? "Loading…" : `${staff.length} employees`} />
          {error && <p className="px-5 text-sm text-rose-500">{error}</p>}
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
                  {s.status === "Active" ? (
                    <button
                      type="button"
                      disabled={actionId === s.id}
                      onClick={() => void deactivate(s.id)}
                      className="rounded-full border border-rose-100 px-2.5 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          {!loading && staff.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-slate-400">No staff records yet.</p>
          )}
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
                <input className={inputClass} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                <input className={inputClass} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <input className={inputClass} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className={inputClass} placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <select className={inputClass} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">Department (optional)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              {formError && <p className="text-sm text-rose-500">{formError}</p>}
              <PrimaryButton disabled={busy} onClick={submit}>
                {busy ? "Saving…" : "Create staff"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
