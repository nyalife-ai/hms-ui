"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import { Badge, Card, CardHeader, PageHeader, PrimaryButton, Table } from "@/components/ui";
import { api } from "@/lib/api";
import { useDoctors, usePatients } from "@/lib/catalog";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type Rx = {
  id: string;
  prescriptionNumber: string | null;
  patientName: string;
  mrn: string;
  prescribedBy: string;
  status: string;
  isVoided: boolean;
  lines: Array<{
    id: string;
    medicationName: string;
    quantity: number;
    status: string;
  }>;
};

type Med = { id: string; medicationName: string };

export default function PharmacyPrescriptionsPage() {
  const { data: patients } = usePatients();
  const { data: doctors } = useDoctors();
  const [rows, setRows] = useState<Rx[]>([]);
  const [meds, setMeds] = useState<Med[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [medicationId, setMedicationId] = useState("");
  const [qty, setQty] = useState("10");

  const load = useCallback(async () => {
    try {
      const [r, m] = await Promise.all([
        api<Rx[]>("/pharmacy/prescriptions"),
        api<Med[]>("/pharmacy/medications"),
      ]);
      setRows(r);
      setMeds(m);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!patientId || !doctorId || !medicationId) return;
    setBusy(true);
    try {
      await api("/pharmacy/prescriptions", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          prescribedByStaffId: doctorId,
          lines: [
            {
              medicationId,
              dosage: "1 tab",
              frequency: "TDS",
              duration: "5 days",
              quantity: Number(qty) || 1,
            },
          ],
        }),
      });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const dispense = async (id: string) => {
    try {
      await api(`/pharmacy/prescriptions/${id}/dispense`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dispense failed");
    }
  };

  return (
    <RoleGuard module="pharmacy">
      <PageHeader
        title="Prescriptions"
        subtitle="Create, dispense, and track pharmacy prescriptions"
        action={
          <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New prescription
          </PrimaryButton>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <Card>
        <CardHeader title="Prescription queue" subtitle={`${rows.length} records`} />
        <Table headers={["Rx #", "Patient", "Prescriber", "Lines", "Status", "Actions"]}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 font-medium text-slate-800">
                {r.prescriptionNumber || r.id.slice(0, 8)}
              </td>
              <td className="px-5 py-3.5 text-slate-500">
                {r.patientName}
                <span className="block text-xs text-slate-400">{r.mrn}</span>
              </td>
              <td className="px-5 py-3.5 text-slate-500">{r.prescribedBy}</td>
              <td className="px-5 py-3.5 text-xs text-slate-500">
                {r.lines.map((l) => (
                  <div key={l.id}>
                    {l.medicationName} × {l.quantity} ({l.status})
                  </div>
                ))}
              </td>
              <td className="px-5 py-3.5">
                <Badge tone={r.status === "DISPENSED" ? "green" : "amber"}>
                  {r.isVoided ? "VOIDED" : r.status}
                </Badge>
              </td>
              <td className="px-5 py-3.5">
                {(r.status === "PENDING" || r.status === "PARTIALLY_DISPENSED") &&
                  !r.isVoided && (
                    <button
                      type="button"
                      className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700"
                      onClick={() => void dispense(r.id)}
                    >
                      Dispense
                    </button>
                  )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex justify-between">
              <h2 className="font-semibold">New prescription</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <select className={inputClass} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Patient</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select className={inputClass} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">Prescribing doctor</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select className={inputClass} value={medicationId} onChange={(e) => setMedicationId(e.target.value)}>
              <option value="">Medication</option>
              {meds.map((m) => (
                <option key={m.id} value={m.id}>{m.medicationName}</option>
              ))}
            </select>
            <input className={inputClass} type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
            <PrimaryButton disabled={busy} onClick={create}>
              {busy ? "Saving…" : "Create"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
