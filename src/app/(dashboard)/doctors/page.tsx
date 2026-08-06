"use client";

import { MessageCircle, Phone, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import { Avatar, Badge, Card, PageHeader, PrimaryButton } from "@/components/ui";
import { api } from "@/lib/api";
import { useDepartments, useDoctors, usePatients, type CatalogDoctor } from "@/lib/catalog";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

export default function DoctorsPage() {
  const router = useRouter();
  const { data: doctors, loading, error, refresh } = useDoctors();
  const { data: departments } = useDepartments();
  const { data: patients } = usePatients();
  const [specialty, setSpecialty] = useState("All");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [spec, setSpec] = useState("General Medicine");
  const [departmentId, setDepartmentId] = useState("");
  const [assignDoctor, setAssignDoctor] = useState<CatalogDoctor | null>(null);
  const [assignPatientId, setAssignPatientId] = useState("");
  const [assignDate, setAssignDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [assignTime, setAssignTime] = useState("09:00");
  const [menuId, setMenuId] = useState("");

  const specialties = useMemo(() => {
    const set = new Set(doctors.map((d) => d.specialty).filter(Boolean));
    return ["All", ...[...set].sort()];
  }, [doctors]);

  const filtered =
    specialty === "All"
      ? doctors
      : doctors.filter((d) => d.specialty === specialty);

  return (
    <RoleGuard module="doctors">
      <PageHeader
        title="Doctors"
        subtitle={
          loading
            ? "Loading doctors…"
            : `${doctors.length} doctors · ${doctors.filter((d) => d.available).length} available today`
        }
        action={
          <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add New Doctor
          </PrimaryButton>
        }
      />

      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200/70 pb-px">
        {specialties.map((s) => (
          <button
            key={s}
            onClick={() => setSpecialty(s)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition ${
              specialty === s
                ? "border-b-2 border-brand-500 text-brand-700"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filtered.map((doc) => (
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
        <p className="py-10 text-center text-sm text-slate-400">Loading from API…</p>
      )}
      {!loading && filtered.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400">No doctors found.</p>
      )}

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
              <select
                className={inputClass}
                value={assignPatientId}
                onChange={(e) => setAssignPatientId(e.target.value)}
              >
                <option value="">Select patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.mrn}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className={inputClass}
                  type="date"
                  value={assignDate}
                  onChange={(e) => setAssignDate(e.target.value)}
                />
                <input
                  className={inputClass}
                  type="time"
                  value={assignTime}
                  onChange={(e) => setAssignTime(e.target.value)}
                />
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
                <input className={inputClass} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                <input className={inputClass} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <input className={inputClass} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className={inputClass} placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <input className={inputClass} placeholder="Specialty" value={spec} onChange={(e) => setSpec(e.target.value)} />
              <select className={inputClass} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">Department (optional)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
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
                        departmentId: departmentId || undefined,
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
