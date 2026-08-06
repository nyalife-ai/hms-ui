"use client";

import { Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import { Avatar, Badge, Card, PageHeader, PrimaryButton, Table } from "@/components/ui";
import { api } from "@/lib/api";
import { usePatients, type CatalogPatient } from "@/lib/catalog";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

export default function PatientsPage() {
  const { data: patients, loading, error, refresh } = usePatients();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<CatalogPatient | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "Other">("Female");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");

  const resetCreate = () => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setDateOfBirth("");
    setGender("Female");
    setFormError("");
  };

  const submit = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setFormError("First name, last name and phone are required.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api("/ops/patients", {
        method: "POST",
        body: JSON.stringify({
          firstName,
          lastName,
          gender,
          phone,
          dateOfBirth: dateOfBirth || undefined,
        }),
      });
      setOpen(false);
      resetCreate();
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not register");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (p: CatalogPatient) => {
    const parts = p.name.trim().split(/\s+/);
    setEdit(p);
    setFirstName(parts[0] || "");
    setLastName(parts.slice(1).join(" ") || "");
    setPhone(p.phone || "");
    setFormError("");
  };

  const saveEdit = async () => {
    if (!edit) return;
    if (!firstName.trim() || !lastName.trim()) {
      setFormError("Name is required.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api(`/patients/${edit.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
        }),
      });
      setEdit(null);
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not update");
    } finally {
      setBusy(false);
    }
  };

  return (
    <RoleGuard module="patients">
      <PageHeader
        title="Patients"
        subtitle={loading ? "Loading patients…" : `${patients.length} registered patients`}
        action={
          <PrimaryButton
            onClick={() => {
              resetCreate();
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Register patient
          </PrimaryButton>
        }
      />
      <Card>
        {error && <p className="px-5 py-4 text-sm text-rose-500">{error}</p>}
        <Table headers={["Patient", "MRN", "Age", "Gender", "Phone", "Last visit", "Status", ""]}>
          {!loading &&
            patients.map((p) => (
              <tr key={p.id} className="transition hover:bg-slate-50/60">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} size="sm" />
                    <span className="font-medium text-slate-800">{p.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-slate-500">{p.mrn}</td>
                <td className="px-5 py-3.5 text-slate-500">{p.age}</td>
                <td className="px-5 py-3.5 text-slate-500">{p.gender}</td>
                <td className="px-5 py-3.5 text-slate-500">{p.phone}</td>
                <td className="px-5 py-3.5 text-slate-500">{p.lastVisit}</td>
                <td className="px-5 py-3.5">
                  <Badge
                    tone={
                      p.status === "Admitted" ? "amber" : p.status === "Active" ? "green" : "slate"
                    }
                  >
                    {p.status}
                  </Badge>
                </td>
                <td className="px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-600"
                    title="Edit patient"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
        </Table>
        {loading && <p className="px-5 py-8 text-center text-sm text-slate-400">Loading from API…</p>}
        {!loading && !error && patients.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-slate-400">No patients registered yet.</p>
        )}
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Register patient</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input className={inputClass} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                <input className={inputClass} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <select className={inputClass} value={gender} onChange={(e) => setGender(e.target.value as "Male" | "Female" | "Other")}>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
              <input className={inputClass} placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <input className={inputClass} type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              {formError && <p className="text-sm text-rose-500">{formError}</p>}
              <PrimaryButton disabled={busy} onClick={submit}>
                {busy ? "Saving…" : "Create patient"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Edit patient · {edit.mrn}</h2>
              <button onClick={() => setEdit(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input className={inputClass} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                <input className={inputClass} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <input className={inputClass} placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
