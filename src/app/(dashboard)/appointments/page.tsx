"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import { Avatar, Badge, Card, PageHeader, PrimaryButton, Table, type BadgeTone } from "@/components/ui";
import { api } from "@/lib/api";
import { useAppointments, useDoctors, usePatients, type CatalogAppointment } from "@/lib/catalog";
import { useVisits } from "@/lib/visits";

const STATUS_TONES: Record<string, BadgeTone> = {
  Scheduled: "blue",
  "Checked In": "teal",
  Completed: "green",
  Cancelled: "red",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

export default function AppointmentsPage() {
  const router = useRouter();
  const { data: appointments, loading, error, refresh } = useAppointments();
  const { data: patients } = usePatients();
  const { data: doctors } = useDoctors();
  const { checkIn } = useVisits();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionId, setActionId] = useState("");
  const [formError, setFormError] = useState("");
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("09:00");
  const [type, setType] = useState("CONSULTATION");
  const [rescheduleId, setRescheduleId] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("09:00");

  const submit = async () => {
    if (!patientId || !doctorId) {
      setFormError("Select patient and doctor.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api("/ops/appointments", {
        method: "POST",
        body: JSON.stringify({ patientId, doctorId, date, time, type }),
      });
      setOpen(false);
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not book");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    setActionId(id);
    try {
      await api(`/appointments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setActionId("");
    }
  };

  const checkInFromSchedule = async (a: CatalogAppointment) => {
    if (!a.mrn) return;
    setActionId(a.id);
    try {
      await checkIn({
        patientName: a.patient,
        mrn: a.mrn,
        age: a.age ?? 0,
        gender: a.gender === "Male" ? "Male" : "Female",
        phone: a.phone || "",
        firstVisit: false,
        appointmentId: a.id,
        payment: { method: "CASH" },
      });
      await refresh();
      router.push("/front-desk");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setActionId("");
    }
  };

  const saveReschedule = async () => {
    if (!rescheduleId || !rescheduleDate || !rescheduleTime) return;
    setBusy(true);
    try {
      const start = new Date(`${rescheduleDate}T${rescheduleTime}:00`);
      const end = new Date(start.getTime() + 30 * 60_000);
      await api(`/appointments/${rescheduleId}`, {
        method: "PATCH",
        body: JSON.stringify({
          appointmentDate: rescheduleDate,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          status: "SCHEDULED",
        }),
      });
      setRescheduleId("");
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Reschedule failed");
    } finally {
      setBusy(false);
    }
  };

  const actionable = (raw?: string) =>
    ["SCHEDULED", "CONFIRMED", "ARRIVED"].includes(raw || "");

  return (
    <RoleGuard module="appointments">
      <PageHeader
        title="Appointments"
        subtitle={
          loading
            ? "Loading…"
            : `${appointments.length} appointments from the clinical schedule`
        }
        action={
          <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New appointment
          </PrimaryButton>
        }
      />
      <Card>
        {error && <p className="px-5 py-3 text-sm text-rose-500">{error}</p>}
        {formError && <p className="px-5 py-3 text-sm text-rose-500">{formError}</p>}
        <Table headers={["Patient", "Doctor", "Department", "Date", "Time", "Type", "Status", "Actions"]}>
          {appointments.map((a) => (
            <tr key={a.id} className="transition hover:bg-slate-50/60">
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={a.patient} size="sm" />
                  <span className="font-medium text-slate-800">{a.patient}</span>
                </div>
              </td>
              <td className="px-5 py-3.5 text-slate-500">{a.doctor}</td>
              <td className="px-5 py-3.5 text-slate-500">{a.department}</td>
              <td className="px-5 py-3.5 text-slate-500">{a.date}</td>
              <td className="px-5 py-3.5 text-slate-500">{a.time}</td>
              <td className="px-5 py-3.5 text-slate-500">{a.type}</td>
              <td className="px-5 py-3.5">
                <Badge tone={STATUS_TONES[a.status]}>{a.status}</Badge>
              </td>
              <td className="px-5 py-3.5">
                {actionable(a.rawStatus) ? (
                  <div className="flex flex-wrap gap-1.5">
                    {a.rawStatus !== "ARRIVED" && (
                      <button
                        type="button"
                        disabled={actionId === a.id}
                        onClick={() => void checkInFromSchedule(a)}
                        className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-40"
                      >
                        Check in
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={actionId === a.id}
                      onClick={() => {
                        setRescheduleId(a.id);
                        setRescheduleDate(a.date);
                        setRescheduleTime(a.time);
                      }}
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-brand-300"
                    >
                      Reschedule
                    </button>
                    <button
                      type="button"
                      disabled={actionId === a.id}
                      onClick={() => void setStatus(a.id, "COMPLETED")}
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-teal-300"
                    >
                      Complete
                    </button>
                    <button
                      type="button"
                      disabled={actionId === a.id}
                      onClick={() => void setStatus(a.id, "CANCELLED")}
                      className="rounded-full border border-rose-100 px-2.5 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Book appointment</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <select className={inputClass} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                <option value="">Select patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.mrn}
                  </option>
                ))}
              </select>
              <select className={inputClass} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                <option value="">Select doctor</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.specialty}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <input className={inputClass} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="CONSULTATION">Consultation</option>
                <option value="FOLLOW_UP">Follow-up</option>
                <option value="NEW_PATIENT">New patient</option>
                <option value="EMERGENCY">Emergency</option>
              </select>
              {formError && <p className="text-sm text-rose-500">{formError}</p>}
              <PrimaryButton disabled={busy} onClick={submit}>
                {busy ? "Booking…" : "Save appointment"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {rescheduleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Reschedule</h2>
              <button onClick={() => setRescheduleId("")} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  className={inputClass}
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                />
                <input
                  className={inputClass}
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                />
              </div>
              <PrimaryButton disabled={busy} onClick={saveReschedule}>
                {busy ? "Saving…" : "Save new time"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
