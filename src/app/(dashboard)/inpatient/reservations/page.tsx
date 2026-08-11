"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DoctorSearchSelect } from "@/components/doctor-search-select";
import { FieldLabel } from "@/components/field-label";
import { PatientSearchSelect } from "@/components/patient-search-select";
import { RoleGuard } from "@/components/role-guard";
import {
  Badge,
  Card,
  CardHeader,
  PageHeader,
  PrimaryButton,
  Table,
} from "@/components/ui";
import { api } from "@/lib/api";
import type { IpdBed } from "@/lib/catalog";
import { unwrapPage } from "@/lib/pagination";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type Reservation = {
  id: string;
  status: string;
  bedId: string;
  bedNumber: string;
  wardName: string;
  patientId: string;
  patientName: string;
  mrn: string;
  expectedAdmissionDate: string;
  expiresAt: string;
  admissionId: string | null;
};

export default function IpdReservationsPage() {
  const [rows, setRows] = useState<Reservation[]>([]);
  const [beds, setBeds] = useState<IpdBed[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [bedId, setBedId] = useState("");
  const [expected, setExpected] = useState("");
  const [expires, setExpires] = useState("");
  const [convertId, setConvertId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [diagnosis, setDiagnosis] = useState("");

  const load = useCallback(async () => {
    try {
      const [r, b] = await Promise.all([
        api("/ipd/reservations?status=RESERVED"),
        api("/ipd/beds?available=true"),
      ]);
      setRows(unwrapPage<Reservation>(r).items);
      setBeds(unwrapPage<IpdBed>(b).items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reservations");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reserve = async () => {
    if (!patientId || !bedId || !expected || !expires) {
      setError("Patient, bed, expected date, and expiry are required");
      return;
    }
    setBusy(true);
    try {
      await api("/ipd/reservations", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          bedId,
          expectedAdmissionDate: expected,
          expiresAt: new Date(expires).toISOString(),
        }),
      });
      setOpen(false);
      setPatientId("");
      setBedId("");
      setExpected("");
      setExpires("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reserve failed");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    try {
      await api(`/ipd/reservations/${id}/cancel`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    }
  };

  const convert = async () => {
    if (!convertId || !doctorId) return;
    setBusy(true);
    try {
      await api(`/ipd/reservations/${convertId}/convert`, {
        method: "POST",
        body: JSON.stringify({
          admittingDoctorId: doctorId,
          primaryDiagnosis: diagnosis || undefined,
        }),
      });
      setConvertId("");
      setDoctorId("");
      setDiagnosis("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Convert failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <RoleGuard module="inpatient">
      <PageHeader
        title="Bed Reservations"
        subtitle="Hold beds ahead of admission"
        action={
          <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Reserve bed
          </PrimaryButton>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      <Card>
        <CardHeader title="Active reservations" subtitle={`${rows.length} pending`} />
        <Table headers={["Patient", "Ward / Bed", "Expected", "Expires", "Status", "Actions"]}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5">
                <p className="font-medium text-slate-800">{r.patientName}</p>
                <p className="text-xs text-slate-400">{r.mrn}</p>
              </td>
              <td className="px-5 py-3.5 text-slate-500">
                {r.wardName} · {r.bedNumber}
              </td>
              <td className="px-5 py-3.5 text-slate-500">{r.expectedAdmissionDate}</td>
              <td className="px-5 py-3.5 text-xs text-slate-400">
                {new Date(r.expiresAt).toLocaleString()}
              </td>
              <td className="px-5 py-3.5">
                <Badge tone="blue">{r.status}</Badge>
              </td>
              <td className="px-5 py-3.5">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConvertId(r.id);
                      setDoctorId("");
                      setDiagnosis("");
                    }}
                    className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
                  >
                    Convert
                  </button>
                  <button
                    type="button"
                    onClick={() => void cancel(r.id)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-slate-400">No active reservations</p>
        )}
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Reserve bed</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <FieldLabel required>Patient</FieldLabel>
                <PatientSearchSelect value={patientId} onChange={(id) => setPatientId(id)} />
              </div>
              <div>
                <FieldLabel required>Available bed</FieldLabel>
                <select className={inputClass} value={bedId} onChange={(e) => setBedId(e.target.value)}>
                  <option value="">Select bed</option>
                  {beds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.wardName} · Bed {b.bedNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel required>Expected admission</FieldLabel>
                <input
                  className={inputClass}
                  type="date"
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                />
              </div>
              <div>
                <FieldLabel required>Expires</FieldLabel>
                <input
                  className={inputClass}
                  type="datetime-local"
                  value={expires}
                  onChange={(e) => setExpires(e.target.value)}
                />
              </div>
              <PrimaryButton disabled={busy} onClick={reserve}>
                {busy ? "Saving…" : "Confirm reservation"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {convertId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Convert to admission</h2>
              <button onClick={() => setConvertId("")} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <FieldLabel required>Admitting doctor</FieldLabel>
                <DoctorSearchSelect value={doctorId} onChange={(id) => setDoctorId(id)} />
              </div>
              <div>
                <FieldLabel optional>Primary diagnosis</FieldLabel>
                <input
                  className={inputClass}
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                />
              </div>
              <PrimaryButton disabled={busy || !doctorId} onClick={convert}>
                {busy ? "Converting…" : "Admit from reservation"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
