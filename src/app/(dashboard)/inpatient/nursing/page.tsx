"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FieldLabel } from "@/components/field-label";
import { DoctorSearchSelect } from "@/components/doctor-search-select";
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
import { useAuth } from "@/lib/auth";
import { useStaffCatalog, type ActiveAdmission } from "@/lib/catalog";
import { unwrapPage } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type NursingNote = {
  id: string;
  notesText: string;
  noteType?: string;
  vitalSignsSnapshot: Record<string, unknown> | null;
  nurseName: string;
  createdAt: string;
};

const NOTE_TYPES = [
  { id: "ADMISSION", label: "Admission assessment" },
  { id: "NURSING", label: "Nursing observation" },
  { id: "PROGRESS", label: "Progress note" },
  { id: "DOCTOR", label: "Physician note" },
  { id: "HANDOVER", label: "Shift handover" },
  { id: "VITALS", label: "Vitals" },
  { id: "MEDICATION", label: "Medication / MAR" },
] as const;

export default function IpdNursingPage() {
  const { user } = useAuth();
  const pickAuthor = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
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
  const [noteType, setNoteType] = useState("NURSING");
  const [notesText, setNotesText] = useState("");
  const [hr, setHr] = useState("72");
  const [bp, setBp] = useState("120/80");
  const [temp, setTemp] = useState("36.8");
  const [spo2, setSpo2] = useState("98");
  const [includeHistory, setIncludeHistory] = useState(false);
  const [history, setHistory] = useState<ActiveAdmission[]>([]);
  const [vitals, setVitals] = useState<
    Array<{
      id: string;
      recordedAt: string;
      recordedBy: string;
      pulse?: unknown;
      bp?: unknown;
      temperature?: unknown;
      spo2?: unknown;
    }>
  >([]);
  const [meds, setMeds] = useState<
    Array<{
      id: string;
      prescriptionNumber: string | null;
      status: string;
      lines: Array<{ medicationName: string; dosage?: string; frequency?: string }>;
    }>
  >([]);
  const [medOpen, setMedOpen] = useState(false);
  const [medsCatalog, setMedsCatalog] = useState<
    Array<{ id: string; medicationName: string; strength: string | null }>
  >([]);
  const [medicationId, setMedicationId] = useState("");
  const [dosage, setDosage] = useState("500mg");
  const [frequency, setFrequency] = useState("TDS");
  const [duration, setDuration] = useState("5 days");
  const [quantity, setQuantity] = useState("15");
  const [prescriberId, setPrescriberId] = useState("");

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
      setVitals([]);
      setMeds([]);
      return;
    }
    try {
      const [rows, v, m] = await Promise.all([
        api<NursingNote[]>(`/ipd/admissions/${admissionId}/nursing-notes`),
        api<typeof vitals>(`/ipd/admissions/${admissionId}/vitals`),
        api<typeof meds>(`/ipd/admissions/${admissionId}/medications`),
      ]);
      setNotes(rows);
      setVitals(v);
      setMeds(Array.isArray(m) ? m : []);
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
    if (!admissionId || !notesText.trim() || (pickAuthor && !nurseId)) {
      setError("Select an admission and enter notes.");
      return;
    }
    setBusy(true);
    try {
      const [sys, dia] = bp.split("/");
      await api(`/ipd/admissions/${admissionId}/nursing-notes`, {
        method: "POST",
        body: JSON.stringify({
          nurseId: pickAuthor ? nurseId : undefined,
          noteType,
          notesText: notesText.trim(),
          vitalSignsSnapshot: {
            pulse: hr,
            bp: bp.trim() || undefined,
            systolic: sys?.trim(),
            diastolic: dia?.trim(),
            temperature: temp,
            spo2,
          },
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

  const loadFormulary = useCallback(async () => {
    try {
      const res = await api<{ items: Array<{ id: string; medicationName: string; strength: string | null }> }>(
        "/pharmacy/medications?active=true&limit=50",
      );
      setMedsCatalog(res.items ?? []);
      if (!medicationId && res.items?.[0]) setMedicationId(res.items[0].id);
    } catch {
      setMedsCatalog([]);
    }
  }, [medicationId]);

  const orderMed = async () => {
    if (!admissionId || !medicationId) {
      setError("Select an admission and a medication.");
      return;
    }
    if (pickAuthor && !prescriberId && user?.role !== "DOCTOR") {
      setError("Select the prescribing doctor.");
      return;
    }
    setBusy(true);
    try {
      await api(`/ipd/admissions/${admissionId}/medications`, {
        method: "POST",
        body: JSON.stringify({
          prescribedByStaffId: user?.role === "DOCTOR" ? undefined : prescriberId || undefined,
          notes: "Ward order",
          lines: [
            {
              medicationId,
              dosage,
              frequency,
              duration,
              quantity: Number(quantity) || 1,
            },
          ],
        }),
      });
      setMedOpen(false);
      await loadNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to order medication");
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
        <label className="mt-3 flex items-center gap-2 text-sm text-foreground-light">
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
        <Table headers={["When", "Type", "Author", "Notes", "Vitals"]}>
          {notes.map((n) => (
            <tr key={n.id} className="transition hover:bg-surface-200/60">
              <td className="px-5 py-3.5 text-foreground-light text-xs">
                {new Date(n.createdAt).toLocaleString()}
              </td>
              <td className="px-5 py-3.5">
                <Badge tone="blue">{n.noteType || "NURSING"}</Badge>
              </td>
              <td className="px-5 py-3.5 text-foreground">{n.nurseName}</td>
              <td className="px-5 py-3.5 text-foreground whitespace-pre-wrap">
                {n.notesText}
              </td>
              <td className="px-5 py-3.5 text-xs text-foreground-light">
                {n.vitalSignsSnapshot
                  ? ["pulse", "hr", "bp", "temperature", "temp", "spo2"]
                      .filter((k) => n.vitalSignsSnapshot?.[k] != null && k !== "noteType")
                      .map((k) => `${k}: ${String(n.vitalSignsSnapshot?.[k])}`)
                      .join(" · ") || "—"
                  : "—"}
              </td>
            </tr>
          ))}
        </Table>
        {!notes.length && (
          <p className="px-5 py-8 text-center text-sm text-foreground-lighter">
            No notes for this admission yet
          </p>
        )}
      </Card>

      <Card className="mt-5">
        <CardHeader
          title="Vitals history"
          subtitle="Every recorded set is kept — not only the latest snapshot"
        />
        <Table headers={["When", "Recorded by", "Pulse", "BP", "Temp", "SpO₂"]}>
          {vitals.map((v) => (
            <tr key={v.id} className="transition hover:bg-surface-200/60">
              <td className="px-5 py-3.5 text-xs text-foreground-light">
                {new Date(v.recordedAt).toLocaleString()}
              </td>
              <td className="px-5 py-3.5 text-foreground">{v.recordedBy}</td>
              <td className="px-5 py-3.5 text-foreground-light">{String(v.pulse ?? "—")}</td>
              <td className="px-5 py-3.5 text-foreground-light">{String(v.bp ?? "—")}</td>
              <td className="px-5 py-3.5 text-foreground-light">{String(v.temperature ?? "—")}</td>
              <td className="px-5 py-3.5 text-foreground-light">{String(v.spo2 ?? "—")}</td>
            </tr>
          ))}
        </Table>
        {!vitals.length && (
          <p className="px-5 py-8 text-center text-sm text-foreground-lighter">
            No vitals recorded for this admission yet
          </p>
        )}
      </Card>

      <Card className="mt-5">
        <CardHeader
          title="Ward medications"
          subtitle="Orders written during this admission (pharmacy + ward)"
        />
        <div className="px-5 pb-3">
          <PrimaryButton
            disabled={!admissionId}
            onClick={() => {
              setMedOpen(true);
              void loadFormulary();
            }}
          >
            <Plus className="h-4 w-4" /> Order medication
          </PrimaryButton>
        </div>
        <Table headers={["Rx", "Medications", "Status"]}>
          {meds.map((rx) => (
            <tr key={rx.id} className="transition hover:bg-surface-200/60">
              <td className="px-5 py-3.5 font-medium text-foreground">
                {rx.prescriptionNumber || rx.id.slice(0, 8)}
              </td>
              <td className="px-5 py-3.5 text-xs text-foreground-light">
                {rx.lines.map((l) => (
                  <div key={l.medicationName}>
                    {l.medicationName}
                    {l.dosage ? ` — ${l.dosage}` : ""}
                    {l.frequency ? ` · ${l.frequency}` : ""}
                  </div>
                ))}
              </td>
              <td className="px-5 py-3.5">
                <Badge tone="amber">{rx.status}</Badge>
              </td>
            </tr>
          ))}
        </Table>
        {!meds.length && (
          <p className="px-5 py-8 text-center text-sm text-foreground-lighter">
            No ward or discharge prescriptions linked to this admission yet
          </p>
        )}
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Add nursing note</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-foreground-lighter hover:bg-surface-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <FieldLabel required>Note type</FieldLabel>
                <select
                  className={inputClass}
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value)}
                >
                  {NOTE_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              {pickAuthor ? (
                <div>
                  <FieldLabel required>Author</FieldLabel>
                  <select
                    className={inputClass}
                    value={nurseId}
                    onChange={(e) => setNurseId(e.target.value)}
                  >
                    <option value="">Select nurse or doctor</option>
                    {nurses.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="rounded-xl bg-surface-200 px-3.5 py-2.5 text-sm text-foreground">
                  Recording as {user?.name || "you"}
                </p>
              )}
              <div>
                <FieldLabel required>Clinical notes</FieldLabel>
                <textarea
                  className={inputClass}
                  rows={4}
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                <div>
                  <FieldLabel optional>SpO₂</FieldLabel>
                  <input className={inputClass} value={spo2} onChange={(e) => setSpo2(e.target.value)} />
                </div>
              </div>
              <PrimaryButton disabled={busy} onClick={() => void addNote()}>
                {busy ? "Saving…" : "Save note"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {medOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Ward medication order</h2>
              <button
                type="button"
                onClick={() => setMedOpen(false)}
                className="rounded-lg p-1 text-foreground-lighter hover:bg-surface-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              {user?.role !== "DOCTOR" ? (
                <div>
                  <FieldLabel required>Prescribing doctor</FieldLabel>
                  <DoctorSearchSelect value={prescriberId} onChange={(id) => setPrescriberId(id)} />
                </div>
              ) : (
                <p className="rounded-xl bg-surface-200 px-3.5 py-2.5 text-sm text-foreground">
                  Prescribed as {user?.name || "you"}
                </p>
              )}
              <div>
                <FieldLabel required>Medication</FieldLabel>
                <select
                  className={inputClass}
                  value={medicationId}
                  onChange={(e) => setMedicationId(e.target.value)}
                >
                  <option value="">Select from formulary</option>
                  {medsCatalog.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.medicationName}
                      {m.strength ? ` · ${m.strength}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel required>Dosage</FieldLabel>
                  <input className={inputClass} value={dosage} onChange={(e) => setDosage(e.target.value)} />
                </div>
                <div>
                  <FieldLabel required>Frequency</FieldLabel>
                  <input className={inputClass} value={frequency} onChange={(e) => setFrequency(e.target.value)} />
                </div>
                <div>
                  <FieldLabel required>Duration</FieldLabel>
                  <input className={inputClass} value={duration} onChange={(e) => setDuration(e.target.value)} />
                </div>
                <div>
                  <FieldLabel required>Quantity</FieldLabel>
                  <input className={inputClass} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </div>
              </div>
              <PrimaryButton disabled={busy} onClick={() => void orderMed()}>
                {busy ? "Ordering…" : "Place order"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
