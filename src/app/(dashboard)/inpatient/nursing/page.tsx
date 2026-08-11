"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FieldLabel } from "@/components/field-label";
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
import { unwrapPage } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

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
  const nurses = staff.filter(
    (s) => s.status === "Active" && (s.role === "NURSE" || s.role === "DOCTOR" || s.role === "ADMIN" || s.role === "SUPER_ADMIN"),
  );
  const [admissions, setAdmissions] = useState<ActiveAdmission[]>([]);
  const [admissionId, setAdmissionId] = useState("");
  const [admitSearch, setAdmitSearch] = useState("");
  const debouncedAdmitSearch = useDebouncedValue(admitSearch, 400);
  const [notes, setNotes] = useState<NursingNote[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nurseId, setNurseId] = useState("");
  const [notesText, setNotesText] = useState("");
  const [hr, setHr] = useState("72");
  const [bp, setBp] = useState("120/80");
  const [temp, setTemp] = useState("36.8");
  const [includeHistory, setIncludeHistory] = useState(false);
  const [history, setHistory] = useState<ActiveAdmission[]>([]);

  const loadAdmissions = useCallback(async () => {
    try {
      const qs = new URLSearchParams({
        active: "true",
        page: "1",
        limit: "50",
      });
      if (debouncedAdmitSearch.trim()) qs.set("search", debouncedAdmitSearch.trim());
      const res = unwrapPage<ActiveAdmission>(
        await api(`/ipd/admissions?${qs.toString()}`),
      );
      setAdmissions(res.items);
      if (!admissionId && res.items[0]) setAdmissionId(res.items[0].id);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load admissions");
    }
  }, [admissionId, debouncedAdmitSearch]);

  const loadHistory = useCallback(async (patientId: string) => {
    if (!patientId) {
      setHistory([]);
      return;
    }
    try {
      const res = unwrapPage<ActiveAdmission>(
        await api(
          `/ipd/admissions?patientId=${encodeURIComponent(patientId)}&page=1&limit=20`,
        ),
      );
      setHistory(res.items.filter((a) => a.id !== admissionId));
    } catch {
      setHistory([]);
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
      setError(err instanceof Error ? err.message : "Unable to load notes");
    }
  }, [admissionId]);

  useEffect(() => {
    void loadAdmissions();
  }, [loadAdmissions]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const selected = useMemo(
    () => admissions.find((a) => a.id === admissionId) ?? null,
    [admissions, admissionId],
  );

  useEffect(() => {
    if (includeHistory && selected?.patientId) {
      void loadHistory(selected.patientId);
    } else {
      setHistory([]);
    }
  }, [includeHistory, selected?.patientId, loadHistory]);

  const addNote = async () => {
    if (!admissionId || !notesText.trim() || !nurseId) {
      setError("Select an admission and nurse, and enter notes.");
      return;
    }
    setBusy(true);
    try {
      const vitalSignsSnapshot = {
        hr: Number(hr) || undefined,
        bp: bp.trim() || undefined,
        temp: Number(temp) || undefined,
      };
      await api(`/ipd/admissions/${admissionId}/nursing-notes`, {
        method: "POST",
        body: JSON.stringify({
          nurseId,
          notesText: notesText.trim(),
          vitalSignsSnapshot,
        }),
      });
      setOpen(false);
      setNotesText("");
      await loadNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save note");
    } finally {
      setBusy(false);
    }
  };

  return (
    <RoleGuard module="inpatient">
      <PageHeader
        title="Nursing notes"
        subtitle="Record daily observations for admitted patients"
        action={
          <PrimaryButton onClick={() => setOpen(true)} disabled={!admissionId}>
            <Plus className="h-4 w-4" /> Add note
          </PrimaryButton>
        }
      />

      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      <Card className="mb-5 p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <FieldLabel>Search admissions</FieldLabel>
            <input
              className={inputClass}
              placeholder="Patient name or MRN…"
              value={admitSearch}
              onChange={(e) => setAdmitSearch(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel required>Active admission</FieldLabel>
            <select
              className={inputClass}
              value={admissionId}
              onChange={(e) => setAdmissionId(e.target.value)}
            >
              <option value="">Select admission</option>
              {admissions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.patientName} · {a.mrn} · {a.wardName} {a.bedNumber}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={includeHistory}
            onChange={(e) => setIncludeHistory(e.target.checked)}
          />
          Show previous admissions for this patient
        </label>
        {includeHistory && history.length > 0 && (
          <div className="mt-3">
            <FieldLabel>Previous admissions</FieldLabel>
            <select
              className={inputClass}
              value=""
              onChange={(e) => {
                if (e.target.value) setAdmissionId(e.target.value);
              }}
            >
              <option value="">Switch to a previous admission…</option>
              {history.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.status} · {a.wardName} ·{" "}
                  {a.admittedAt ? new Date(a.admittedAt).toLocaleDateString() : "—"}
                </option>
              ))}
            </select>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title={selected ? `Notes · ${selected.patientName}` : "Notes"}
          subtitle={
            selected
              ? `${selected.wardName} · Bed ${selected.bedNumber} · ${selected.mrn}`
              : "Select an admission"
          }
        />
        <Table headers={["When", "Nurse", "Notes", "Vitals"]}>
          {notes.map((n) => (
            <tr key={n.id} className="transition hover:bg-slate-50/60">
              <td className="px-5 py-3.5 text-slate-500 text-xs">
                {new Date(n.createdAt).toLocaleString()}
              </td>
              <td className="px-5 py-3.5 text-slate-700">{n.nurseName}</td>
              <td className="px-5 py-3.5 text-slate-700 whitespace-pre-wrap">
                {n.notesText}
              </td>
              <td className="px-5 py-3.5 text-xs text-slate-500">
                {n.vitalSignsSnapshot
                  ? Object.entries(n.vitalSignsSnapshot)
                      .map(([k, v]) => `${k}: ${String(v)}`)
                      .join(" · ")
                  : "—"}
              </td>
            </tr>
          ))}
        </Table>
        {!notes.length && (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            No notes for this admission yet
          </p>
        )}
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Add nursing note</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <FieldLabel required>Nurse</FieldLabel>
                <select
                  className={inputClass}
                  value={nurseId}
                  onChange={(e) => setNurseId(e.target.value)}
                >
                  <option value="">Select nurse</option>
                  {nurses.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel required>Clinical notes</FieldLabel>
                <textarea
                  className={inputClass}
                  rows={4}
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <FieldLabel optional>Heart rate</FieldLabel>
                  <input className={inputClass} value={hr} onChange={(e) => setHr(e.target.value)} />
                </div>
                <div>
                  <FieldLabel optional>Blood pressure</FieldLabel>
                  <input className={inputClass} value={bp} onChange={(e) => setBp(e.target.value)} />
                </div>
                <div>
                  <FieldLabel optional>Temperature °C</FieldLabel>
                  <input className={inputClass} value={temp} onChange={(e) => setTemp(e.target.value)} />
                </div>
              </div>
              <PrimaryButton disabled={busy} onClick={() => void addNote()}>
                {busy ? "Saving…" : "Save note"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
