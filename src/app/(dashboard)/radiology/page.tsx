"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import { Avatar, Badge, Card, PageHeader, PrimaryButton, Table, type BadgeTone } from "@/components/ui";
import { api } from "@/lib/api";
import { useDoctors, usePatients, useRadiologyQueue, useScanTypes } from "@/lib/catalog";

const STATUS_TONES: Record<string, BadgeTone> = {
  Scheduled: "blue",
  "In Progress": "amber",
  "Report Pending": "amber",
  Completed: "green",
  Cancelled: "red",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

export default function RadiologyPage() {
  const { data: scans, loading, error, refresh } = useRadiologyQueue();
  const { data: patients } = usePatients();
  const { data: doctors } = useDoctors();
  const { data: scanTypes } = useScanTypes();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionId, setActionId] = useState("");
  const [formError, setFormError] = useState("");
  const [patientId, setPatientId] = useState("");
  const [scanTypeId, setScanTypeId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [indication, setIndication] = useState("");

  const submit = async () => {
    if (!patientId || !scanTypeId) {
      setFormError("Select patient and scan type.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api("/ops/radiology-requests", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          scanTypeId,
          requestingDoctorId: doctorId || undefined,
          indication: indication || undefined,
        }),
      });
      setOpen(false);
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    setActionId(id);
    try {
      await api(`/radiology/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not update status");
    } finally {
      setActionId("");
    }
  };

  return (
    <RoleGuard module="radiology">
      <PageHeader
        title="Radiology"
        subtitle={loading ? "Loading…" : "Imaging requests — start, complete, or cancel"}
        action={
          <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New scan request
          </PrimaryButton>
        }
      />
      <Card>
        {error && <p className="px-5 py-3 text-sm text-rose-500">{error}</p>}
        {formError && <p className="px-5 py-3 text-sm text-rose-500">{formError}</p>}
        <Table headers={["Patient", "Scan", "Requested by", "Scheduled", "Status", "Actions"]}>
          {scans.map((r) => {
            const raw = r.rawStatus || "";
            const openScan = ["PENDING", "SCHEDULED", "IN_PROGRESS"].includes(raw);
            return (
              <tr key={r.id} className="transition hover:bg-slate-50/60">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.patient} size="sm" />
                    <span className="font-medium text-slate-800">{r.patient}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-slate-500">{r.scan}</td>
                <td className="px-5 py-3.5 text-slate-500">{r.requestedBy}</td>
                <td className="px-5 py-3.5 text-slate-500">{r.scheduled}</td>
                <td className="px-5 py-3.5">
                  <Badge tone={STATUS_TONES[r.status]}>{r.status}</Badge>
                </td>
                <td className="px-5 py-3.5">
                  {openScan ? (
                    <div className="flex flex-wrap gap-1.5">
                      {raw !== "IN_PROGRESS" && (
                        <button
                          type="button"
                          disabled={actionId === r.id}
                          onClick={() => void setStatus(r.id, "IN_PROGRESS")}
                          className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-amber-300"
                        >
                          Start
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={actionId === r.id}
                        onClick={() => void setStatus(r.id, "COMPLETED")}
                        className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700 hover:bg-brand-100"
                      >
                        Complete
                      </button>
                      <button
                        type="button"
                        disabled={actionId === r.id}
                        onClick={() => void setStatus(r.id, "CANCELLED")}
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
            );
          })}
        </Table>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">New scan request</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <select className={inputClass} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                <option value="">Select patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select className={inputClass} value={scanTypeId} onChange={(e) => setScanTypeId(e.target.value)}>
                <option value="">Select scan</option>
                {scanTypes.map((s) => (
                  <option key={s.id} value={s.id}>{s.scan_type}</option>
                ))}
              </select>
              <select className={inputClass} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                <option value="">Requesting doctor (optional)</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <input
                className={inputClass}
                value={indication}
                onChange={(e) => setIndication(e.target.value)}
                placeholder="Clinical indication"
              />
              {formError && <p className="text-sm text-rose-500">{formError}</p>}
              <PrimaryButton disabled={busy} onClick={submit}>
                {busy ? "Submitting…" : "Create request"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
