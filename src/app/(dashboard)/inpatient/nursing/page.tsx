"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import {
  Card,
  CardHeader,
  PageHeader,
  PrimaryButton,
  Table,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useStaffCatalog, type ActiveAdmission } from "@/lib/catalog";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type NursingNote = {
  id: string;
  notesText: string;
  vitalSignsSnapshot: Record<string, unknown> | null;
  nurseName: string;
  createdAt: string;
};

export default function IpdNursingPage() {
  const { data: staff } = useStaffCatalog();
  const nurses = staff.filter((s) =>
    /nurse|admin|doctor/i.test(s.role) || s.role === "NURSE",
  );
  const [admissions, setAdmissions] = useState<ActiveAdmission[]>([]);
  const [admissionId, setAdmissionId] = useState("");
  const [notes, setNotes] = useState<NursingNote[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nurseId, setNurseId] = useState("");
  const [notesText, setNotesText] = useState("");
  const [vitalsJson, setVitalsJson] = useState('{"hr":72,"bp":"120/80","temp":36.8}');

  const loadAdmissions = useCallback(async () => {
    try {
      const rows = await api<ActiveAdmission[]>("/ipd/admissions?active=true");
      setAdmissions(rows);
      if (!admissionId && rows[0]) setAdmissionId(rows[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admissions");
    }
  }, [admissionId]);

  const loadNotes = useCallback(async () => {
    if (!admissionId) {
      setNotes([]);
      return;
    }
    try {
      const rows = await api<NursingNote[]>(
        `/ipd/admissions/${admissionId}/nursing-notes`,
      );
      setNotes(rows);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notes");
    }
  }, [admissionId]);

  useEffect(() => {
    void loadAdmissions();
  }, [loadAdmissions]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const addNote = async () => {
    if (!admissionId || !notesText.trim() || !nurseId) {
      setError("Select admission, nurse, and enter notes");
      return;
    }
    let vitalSignsSnapshot: Record<string, unknown> | undefined;
    if (vitalsJson.trim()) {
      try {
        vitalSignsSnapshot = JSON.parse(vitalsJson) as Record<string, unknown>;
      } catch {
        setError("Vital signs must be valid JSON");
        return;
      }
    }
    setBusy(true);
    try {
      await api(`/ipd/admissions/${admissionId}/nursing-notes`, {
        method: "POST",
        body: JSON.stringify({
          nurseId,
          notesText,
          vitalSignsSnapshot,
        }),
      });
      setOpen(false);
      setNotesText("");
      await loadNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save note");
    } finally {
      setBusy(false);
    }
  };

  const selected = admissions.find((a) => a.id === admissionId);

  return (
    <RoleGuard module="inpatient">
      <PageHeader
        title="Nursing / Clinical Records"
        subtitle="Append-only nursing notes for active admissions"
        action={
          <PrimaryButton
            onClick={() => setOpen(true)}
            disabled={!admissionId}
          >
            <Plus className="h-4 w-4" /> Add note
          </PrimaryButton>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      <div className="mb-4 max-w-lg">
        <select
          className={inputClass}
          value={admissionId}
          onChange={(e) => setAdmissionId(e.target.value)}
        >
          <option value="">Select active admission</option>
          {admissions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.patientName} · {a.wardName} Bed {a.bedNumber}
            </option>
          ))}
        </select>
        {selected && (
          <p className="mt-2 text-sm text-slate-500">
            {selected.diagnosis || "No diagnosis"} · admitted{" "}
            {new Date(selected.admittedAt).toLocaleString()}
          </p>
        )}
      </div>

      <Card>
        <CardHeader
          title="Note history"
          subtitle={selected ? selected.patientName : "Select an admission"}
        />
        <Table headers={["When", "Nurse", "Notes", "Vitals"]}>
          {notes.map((n) => (
            <tr key={n.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 text-xs text-slate-400">
                {new Date(n.createdAt).toLocaleString()}
              </td>
              <td className="px-5 py-3.5 text-slate-600">{n.nurseName}</td>
              <td className="px-5 py-3.5 text-slate-700 whitespace-pre-wrap">
                {n.notesText}
              </td>
              <td className="px-5 py-3.5 font-mono text-xs text-slate-500">
                {n.vitalSignsSnapshot
                  ? JSON.stringify(n.vitalSignsSnapshot)
                  : "—"}
              </td>
            </tr>
          ))}
        </Table>
        {admissionId && notes.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            No nursing notes yet for this admission
          </p>
        )}
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Add nursing note</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <select className={inputClass} value={nurseId} onChange={(e) => setNurseId(e.target.value)}>
                <option value="">Responsible nurse / clinician</option>
                {(nurses.length ? nurses : staff).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
              <textarea
                className={`${inputClass} min-h-28 resize-y`}
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder="Clinical notes"
              />
              <textarea
                className={`${inputClass} min-h-20 resize-y font-mono text-xs`}
                value={vitalsJson}
                onChange={(e) => setVitalsJson(e.target.value)}
                placeholder='Vital signs JSON e.g. {"hr":72}'
              />
              <PrimaryButton disabled={busy} onClick={addNote}>
                {busy ? "Saving…" : "Save note"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
