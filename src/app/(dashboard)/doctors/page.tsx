"use client";

import { MessageCircle, Phone, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BulkImportButton } from "@/components/bulk-import-button";
import { FieldLabel } from "@/components/field-label";
import { PaginationBar } from "@/components/pagination-bar";
import { PatientSearchSelect } from "@/components/patient-search-select";
import { RoleGuard } from "@/components/role-guard";
import { Avatar, Badge, Card, PageHeader, PrimaryButton } from "@/components/ui";
import { api } from "@/lib/api";
import {
  useDepartments,
  usePaginatedCatalog,
  type CatalogDoctor,
} from "@/lib/catalog";
import { toPageMeta } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

export default function DoctorsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [departmentId, setDepartmentFilter] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const params = useMemo(
    () => ({
      page,
      limit: 50,
      search: search || undefined,
      departmentId: departmentId || undefined,
    }),
    [page, search, departmentId],
  );
  const { items: doctors, total, limit, loading, error, refresh } =
    usePaginatedCatalog<CatalogDoctor>("/catalog/doctors", params);
  const { data: departments } = useDepartments();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [spec, setSpec] = useState("General Medicine");
  const [createDeptId, setCreateDeptId] = useState("");
  const [assignDoctor, setAssignDoctor] = useState<CatalogDoctor | null>(null);
  const [assignPatientId, setAssignPatientId] = useState("");
  const [assignDate, setAssignDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [assignTime, setAssignTime] = useState("09:00");
  const [menuId, setMenuId] = useState("");

  const meta = toPageMeta({ total, page, limit });
  const availableCount = doctors.filter((d) => d.available).length;

  return (
    <RoleGuard module="doctors">
      <PageHeader
        title="Doctors"
        subtitle={
          loading
            ? "Loading doctors…"
            : `${total.toLocaleString()} doctors · ${availableCount} available on this page`
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <BulkImportButton
              resource="doctors"
              title="Import doctors / staff"
              description="Download the template, fill details (no passwords), then review before importing."
              label="Import doctors"
              onImported={refresh}
            />
            <PrimaryButton onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Add New Doctor
            </PrimaryButton>
          </div>
        }
      />

      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      <div className="mb-5 grid grid-cols-1 gap-2 md:grid-cols-2">
        <input
          className={inputClass}
          placeholder="Search name or specialty…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={inputClass}
          value={departmentId}
          onChange={(e) => {
            setDepartmentFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {doctors.map((doc) => (
          <Card key={doc.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{doc.name}</h3>
                <div className="mt-1.5">
                  <Badge tone={doc.available ? "teal" : "red"}>
                    {doc.available ? "Available" : "Unavailable"}
                  </Badge>
                </div>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuId(menuId === doc.id ? "" : doc.id)}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                >
                  Details
                </button>
                {menuId === doc.id && (
                  <div className="absolute right-0 z-10 mt-1 w-44 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-slate-100">
                    <button
                      type="button"
                      className="block w-full rounded-lg px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                      onClick={() => {
                        setMenuId("");
                        router.push(`/appointments`);
                      }}
                    >
                      View schedule
                    </button>
                    <a
                      href={`mailto:${doc.email}`}
                      className="block w-full rounded-lg px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                      onClick={() => setMenuId("")}
                    >
                      Email doctor
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="my-5 flex justify-center">
              <Avatar name={doc.name} size="lg" />
            </div>

            <div className="border-t border-slate-50 pt-3 text-center">
              <p className="text-sm font-semibold text-slate-800">{doc.specialty}</p>
              <p className="mt-0.5 text-xs text-slate-400">{doc.hours}</p>
              <p className="mt-1 truncate text-[11px] text-slate-400">{doc.email}</p>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                title="Message"
                onClick={() => {
                  void api("/ops/conversations", {
                    method: "POST",
                    body: JSON.stringify({
                      name: doc.name,
                      preview: `Care coordination with ${doc.name}`,
                    }),
                  }).then(() => router.push("/messages"));
                }}
                className="rounded-full border border-slate-200 p-2.5 text-slate-400 transition hover:border-brand-300 hover:text-brand-600"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
              <a
                title="Call"
                href={doc.phone ? `tel:${doc.phone.replace(/\s+/g, "")}` : undefined}
                className={`rounded-full border border-slate-200 p-2.5 transition ${
                  doc.phone
                    ? "text-slate-400 hover:border-brand-300 hover:text-brand-600"
                    : "pointer-events-none text-slate-200"
                }`}
              >
                <Phone className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => {
                  setAssignDoctor(doc);
                  setAssignPatientId("");
                  setFormError("");
                }}
                className="flex-1 rounded-full bg-brand-50 py-2.5 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
              >
                Assign Patient
              </button>
            </div>
          </Card>
        ))}
      </div>
      {loading && (
        <div className="space-y-2 py-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      )}
      {!loading && doctors.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400">No doctors found.</p>
      )}
      <div className="mt-4 rounded-2xl border border-slate-100 bg-white">
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </div>

      {assignDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Assign patient · {assignDoctor.name}
              </h2>
              <button onClick={() => setAssignDoctor(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <FieldLabel required>Patient</FieldLabel>
                <PatientSearchSelect
                  value={assignPatientId}
                  onChange={(id) => setAssignPatientId(id)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel required>Date</FieldLabel>
                  <input
                    className={inputClass}
                    type="date"
                    value={assignDate}
                    onChange={(e) => setAssignDate(e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel required>Time</FieldLabel>
                  <input
                    className={inputClass}
                    type="time"
                    value={assignTime}
                    onChange={(e) => setAssignTime(e.target.value)}
                  />
                </div>
              </div>
              {formError && <p className="text-sm text-rose-500">{formError}</p>}
              <PrimaryButton
                disabled={busy}
                onClick={async () => {
                  if (!assignPatientId) {
                    setFormError("Select a patient.");
                    return;
                  }
                  setBusy(true);
                  setFormError("");
                  try {
                    await api("/ops/appointments", {
                      method: "POST",
                      body: JSON.stringify({
                        patientId: assignPatientId,
                        doctorId: assignDoctor.id,
                        date: assignDate,
                        time: assignTime,
                        type: "CONSULTATION",
                      }),
                    });
                    setAssignDoctor(null);
                    router.push("/appointments");
                  } catch (err) {
                    setFormError(err instanceof Error ? err.message : "Could not assign");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Booking…" : "Book appointment"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Add doctor</h2>
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
                <FieldLabel required>Specialty</FieldLabel>
                <input className={inputClass} value={spec} onChange={(e) => setSpec(e.target.value)} />
              </div>
              <div>
                <FieldLabel optional>Department</FieldLabel>
                <select className={inputClass} value={createDeptId} onChange={(e) => setCreateDeptId(e.target.value)}>
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              {formError && <p className="text-sm text-rose-500">{formError}</p>}
              <PrimaryButton
                disabled={busy}
                onClick={async () => {
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
                        role: "DOCTOR",
                        specialty: spec,
                        departmentId: createDeptId || undefined,
                        asDoctor: true,
                      }),
                    });
                    setOpen(false);
                    await refresh();
                  } catch (err) {
                    setFormError(err instanceof Error ? err.message : "Failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Saving…" : "Create doctor"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
