"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  PageHeader,
  PrimaryButton,
  Table,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  useDoctors,
  usePatients,
  useWards,
  type ActiveAdmission,
  type IpdBed,
} from "@/lib/catalog";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

export default function IpdAdmissionsPage() {
  const { user } = useAuth();
  const { data: wards, loading, error, refresh } = useWards();
  const { data: patients } = usePatients();
  const { data: doctors } = useDoctors();
  const totalBeds = wards.reduce((sum, w) => sum + w.totalBeds, 0);
  const occupied = wards.reduce((sum, w) => sum + w.occupied, 0);

  const [admissions, setAdmissions] = useState<ActiveAdmission[]>([]);
  const [beds, setBeds] = useState<IpdBed[]>([]);
  const [listError, setListError] = useState("");

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [patientId, setPatientId] = useState("");
  const [wardId, setWardId] = useState("");
  const [bedId, setBedId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [reason, setReason] = useState("");

  const [dischargeId, setDischargeId] = useState("");
  const [dischargeDoctorId, setDischargeDoctorId] = useState("");
  const [dischargeSummary, setDischargeSummary] = useState("");
  const [dischargeDiagnosis, setDischargeDiagnosis] = useState("");
  const [dischargeMeds, setDischargeMeds] = useState("");
  const [dischargeFollowUp, setDischargeFollowUp] = useState("");
  const [dischargeBusy, setDischargeBusy] = useState(false);

  const [transferId, setTransferId] = useState("");
  const [transferBedId, setTransferBedId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);

  const [transferOutId, setTransferOutId] = useState("");
  const [transferOutReason, setTransferOutReason] = useState("");
  const [transferOutDest, setTransferOutDest] = useState("");
  const [transferOutBusy, setTransferOutBusy] = useState(false);

  const [history, setHistory] = useState<ActiveAdmission[]>([]);
  const [summaryView, setSummaryView] = useState<{
    admissionId: string;
    patientName: string;
    dischargeDiagnosis: string | null;
    summaryOfTreatment: string | null;
    dischargeMedications: string | null;
    followUpInstructions: string | null;
    finalizedAt: string | null;
  } | null>(null);

  const refreshBoard = useCallback(async () => {
    try {
      const [a, b, discharged, transferred] = await Promise.all([
        api<ActiveAdmission[]>("/ipd/admissions?active=true"),
        api<IpdBed[]>("/ipd/beds?available=true"),
        api<ActiveAdmission[]>("/ipd/admissions?status=DISCHARGED&take=15"),
        api<ActiveAdmission[]>("/ipd/admissions?status=TRANSFERRED&take=10"),
      ]);
      setAdmissions(a);
      setBeds(b);
      setHistory([...discharged, ...transferred].slice(0, 20));
      setListError("");
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not load admissions");
    }
  }, []);

  useEffect(() => {
    void refreshBoard();
  }, [refreshBoard]);

  const availableForWard = beds.filter((b) => !wardId || b.wardId === wardId);

  const admit = async () => {
    if (!patientId || !doctorId) {
      setFormError("Select patient and admitting doctor.");
      return;
    }
    const chosenBed =
      bedId || beds.find((b) => b.wardId === wardId)?.id || beds[0]?.id;
    if (!chosenBed) {
      setFormError("No available bed — free a bed or pick another ward.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api("/ipd/admissions", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          bedId: chosenBed,
          admittingDoctorId: doctorId,
          primaryDiagnosis: reason || undefined,
        }),
      });
      setOpen(false);
      setPatientId("");
      setWardId("");
      setBedId("");
      setDoctorId("");
      setReason("");
      await Promise.all([refresh(), refreshBoard()]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Admission failed");
    } finally {
      setBusy(false);
    }
  };

  const discharge = async () => {
    if (!dischargeId || !dischargeDoctorId) return;
    setDischargeBusy(true);
    try {
      await api(`/ipd/admissions/${dischargeId}/discharge`, {
        method: "POST",
        body: JSON.stringify({
          dischargingDoctorId: dischargeDoctorId,
          diagnosis: dischargeDiagnosis || undefined,
          summary: dischargeSummary || undefined,
          medications: dischargeMeds || undefined,
          followUpInstructions: dischargeFollowUp || undefined,
        }),
      });
      setDischargeId("");
      setDischargeSummary("");
      setDischargeDiagnosis("");
      setDischargeMeds("");
      setDischargeFollowUp("");
      await Promise.all([refresh(), refreshBoard()]);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Discharge failed");
    } finally {
      setDischargeBusy(false);
    }
  };

  const transfer = async () => {
    if (!transferId || !transferBedId || !user?.id) return;
    setTransferBusy(true);
    try {
      await api(`/ipd/admissions/${transferId}/transfer`, {
        method: "POST",
        body: JSON.stringify({
          newBedId: transferBedId,
          reason: transferReason || undefined,
          authorizedBy: user.id,
        }),
      });
      setTransferId("");
      setTransferBedId("");
      setTransferReason("");
      await Promise.all([refresh(), refreshBoard()]);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setTransferBusy(false);
    }
  };

  const transferOut = async () => {
    if (!transferOutId || !transferOutReason.trim() || !user?.id) return;
    setTransferOutBusy(true);
    try {
      await api(`/ipd/admissions/${transferOutId}/transfer-out`, {
        method: "POST",
        body: JSON.stringify({
          reason: transferOutReason,
          destination: transferOutDest || undefined,
          authorizedBy: user.id,
        }),
      });
      setTransferOutId("");
      setTransferOutReason("");
      setTransferOutDest("");
      await Promise.all([refresh(), refreshBoard()]);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Transfer-out failed");
    } finally {
      setTransferOutBusy(false);
    }
  };

  const viewSummary = async (admission: ActiveAdmission) => {
    try {
      const summary = await api<{
        dischargeDiagnosis: string | null;
        summaryOfTreatment: string | null;
        dischargeMedications: string | null;
        followUpInstructions: string | null;
        finalizedAt: string | null;
      }>(`/ipd/admissions/${admission.id}/discharge-summary`);
      setSummaryView({
        admissionId: admission.id,
        patientName: admission.patientName,
        ...summary,
      });
      setListError("");
    } catch (err) {
      setListError(
        err instanceof Error
          ? err.message
          : "No discharge summary for this admission",
      );
    }
  };

  return (
    <RoleGuard module="inpatient">
      <PageHeader
        title="IPD Admissions"
        subtitle={
          loading
            ? "Loading wards…"
            : `${occupied} of ${totalBeds} beds occupied · ${admissions.length} active`
        }
        action={
          <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Admit patient
          </PrimaryButton>
        }
      />
      {(error || listError) && (
        <p className="mb-4 text-sm text-rose-500">{error || listError}</p>
      )}

      <Card>
        <CardHeader title="Active admissions" subtitle="Discharge or transfer beds" />
        <Table headers={["Patient", "Ward / Bed", "Doctor", "Diagnosis", "Status", "Actions"]}>
          {admissions.map((a) => (
            <tr key={a.id} className="transition hover:bg-slate-50/60">
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={a.patientName} size="sm" />
                  <div>
                    <p className="font-medium text-slate-800">{a.patientName}</p>
                    <p className="text-xs text-slate-400">{a.mrn}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3.5 text-slate-500">
                {a.wardName} · Bed {a.bedNumber}
              </td>
              <td className="px-5 py-3.5 text-slate-500">{a.admittingDoctor}</td>
              <td className="px-5 py-3.5 text-slate-500">{a.diagnosis || "—"}</td>
              <td className="px-5 py-3.5">
                <Badge tone="amber">{a.status}</Badge>
              </td>
              <td className="px-5 py-3.5">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTransferId(a.id);
                      setTransferBedId("");
                      setTransferReason("");
                    }}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
                  >
                    Transfer bed
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTransferOutId(a.id);
                      setTransferOutReason("");
                      setTransferOutDest("");
                    }}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-amber-300 hover:text-amber-700"
                  >
                    Transfer out
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDischargeId(a.id);
                      setDischargeDoctorId(a.admittingDoctorId);
                      setDischargeSummary("");
                      setDischargeDiagnosis(a.diagnosis || "");
                      setDischargeMeds("");
                      setDischargeFollowUp("");
                    }}
                    className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
                  >
                    Discharge
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {admissions.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            No active admissions — admit a patient to occupy a bed.
          </p>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Closed admissions"
          subtitle="Discharged / transferred-out — summaries are read-only after finalize"
        />
        <Table headers={["Patient", "Status", "Diagnosis", "Actions"]}>
          {history.map((h) => (
            <tr key={h.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5">
                <p className="font-medium text-slate-800">{h.patientName}</p>
                <p className="text-xs text-slate-400">{h.mrn}</p>
              </td>
              <td className="px-5 py-3.5">
                <Badge tone={h.status === "DISCHARGED" ? "green" : "blue"}>
                  {h.status}
                </Badge>
              </td>
              <td className="px-5 py-3.5 text-slate-500">{h.diagnosis || "—"}</td>
              <td className="px-5 py-3.5">
                {h.status === "DISCHARGED" && (
                  <button
                    type="button"
                    onClick={() => void viewSummary(h)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
                  >
                    View summary
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
        {history.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            No closed admissions yet
          </p>
        )}
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Admit patient</h2>
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
              <select
                className={inputClass}
                value={wardId}
                onChange={(e) => {
                  setWardId(e.target.value);
                  setBedId("");
                }}
              >
                <option value="">Any ward with free beds</option>
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.totalBeds - w.occupied} free)
                  </option>
                ))}
              </select>
              <select className={inputClass} value={bedId} onChange={(e) => setBedId(e.target.value)}>
                <option value="">First available bed</option>
                {availableForWard.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.wardName} · Bed {b.bedNumber}
                  </option>
                ))}
              </select>
              <select className={inputClass} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                <option value="">Admitting doctor</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <input
                className={inputClass}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Primary diagnosis / reason"
              />
              {formError && <p className="text-sm text-rose-500">{formError}</p>}
              <PrimaryButton disabled={busy} onClick={admit}>
                {busy ? "Admitting…" : "Confirm admission"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {dischargeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Discharge patient</h2>
              <button onClick={() => setDischargeId("")} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <select
                className={inputClass}
                value={dischargeDoctorId}
                onChange={(e) => setDischargeDoctorId(e.target.value)}
              >
                <option value="">Discharging doctor</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <input
                className={inputClass}
                value={dischargeDiagnosis}
                onChange={(e) => setDischargeDiagnosis(e.target.value)}
                placeholder="Discharge diagnosis"
              />
              <textarea
                className={`${inputClass} min-h-20 resize-y`}
                value={dischargeSummary}
                onChange={(e) => setDischargeSummary(e.target.value)}
                placeholder="Summary of treatment"
              />
              <textarea
                className={`${inputClass} min-h-16 resize-y`}
                value={dischargeMeds}
                onChange={(e) => setDischargeMeds(e.target.value)}
                placeholder="Discharge medications"
              />
              <textarea
                className={`${inputClass} min-h-16 resize-y`}
                value={dischargeFollowUp}
                onChange={(e) => setDischargeFollowUp(e.target.value)}
                placeholder="Follow-up instructions"
              />
              <PrimaryButton disabled={dischargeBusy || !dischargeDoctorId} onClick={discharge}>
                {dischargeBusy ? "Discharging…" : "Finalize & discharge"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {transferId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Transfer bed</h2>
              <button onClick={() => setTransferId("")} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <select
                className={inputClass}
                value={transferBedId}
                onChange={(e) => setTransferBedId(e.target.value)}
              >
                <option value="">Select available bed</option>
                {beds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.wardName} · Bed {b.bedNumber}
                  </option>
                ))}
              </select>
              <input
                className={inputClass}
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="Transfer reason"
              />
              <PrimaryButton disabled={transferBusy || !transferBedId} onClick={transfer}>
                {transferBusy ? "Transferring…" : "Confirm transfer"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {transferOutId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Transfer out of facility</h2>
              <button onClick={() => setTransferOutId("")} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                Sets admission status to TRANSFERRED, frees the bed, and removes the patient from the active board.
              </p>
              <input
                className={inputClass}
                value={transferOutReason}
                onChange={(e) => setTransferOutReason(e.target.value)}
                placeholder="Reason (required)"
              />
              <input
                className={inputClass}
                value={transferOutDest}
                onChange={(e) => setTransferOutDest(e.target.value)}
                placeholder="Destination facility (optional)"
              />
              <PrimaryButton
                disabled={transferOutBusy || !transferOutReason.trim()}
                onClick={transferOut}
              >
                {transferOutBusy ? "Transferring…" : "Confirm transfer-out"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {summaryView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Discharge summary · {summaryView.patientName}
              </h2>
              <button onClick={() => setSummaryView(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-700">
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Finalized records are locked and cannot be edited.
                {summaryView.finalizedAt
                  ? ` Finalized ${new Date(summaryView.finalizedAt).toLocaleString()}.`
                  : ""}
              </p>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Diagnosis</p>
                <p className="mt-1">{summaryView.dischargeDiagnosis || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Treatment summary</p>
                <p className="mt-1 whitespace-pre-wrap">{summaryView.summaryOfTreatment || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Medications</p>
                <p className="mt-1 whitespace-pre-wrap">{summaryView.dischargeMedications || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Follow-up</p>
                <p className="mt-1 whitespace-pre-wrap">{summaryView.followUpInstructions || "—"}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
