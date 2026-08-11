"use client";

import Link from "next/link";
import { Ban, Eye, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DoctorSearchSelect } from "@/components/doctor-search-select";
import { FieldLabel } from "@/components/field-label";
import { PaginationBar } from "@/components/pagination-bar";
import { PatientSearchSelect } from "@/components/patient-search-select";
import { RoleGuard } from "@/components/role-guard";
import { TableAction } from "@/components/table-action";
import { Badge, Card, CardHeader, PageHeader, PrimaryButton, Table } from "@/components/ui";
import { api } from "@/lib/api";
import { buildListQuery, toPageMeta, unwrapPage } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type Rx = {
  id: string;
  prescriptionNumber: string | null;
  patientName: string;
  mrn: string;
  prescribedBy: string;
  prescriptionDate?: string;
  status: string;
  notes: string | null;
  consultationId?: string | null;
  isVoided: boolean;
  voidReason?: string | null;
  voidedByName?: string | null;
  lines: Array<{
    id: string;
    medicationName: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    quantity: number;
    instructions?: string | null;
    status: string;
    dispensedByName?: string | null;
    dispensedAt?: string | null;
  }>;
};

type Med = { id: string; medicationName: string };
type DraftLine = {
  medicationId: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
};

const emptyLine = (): DraftLine => ({
  medicationId: "",
  dosage: "",
  frequency: "",
  duration: "",
  quantity: "10",
  instructions: "",
});

export default function PharmacyPrescriptionsPage() {
  const [rows, setRows] = useState<Rx[]>([]);
  const [meds, setMeds] = useState<Med[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [rxNotes, setRxNotes] = useState("");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([emptyLine()]);
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState<Rx | null>(null);
  const [cancelId, setCancelId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [voidId, setVoidId] = useState("");
  const [voidReason, setVoidReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildListQuery({
        page,
        limit: 50,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      const [r, m] = await Promise.all([
        api(`/pharmacy/prescriptions?${qs}`),
        api("/pharmacy/medications?limit=100"),
      ]);
      const rxPage = unwrapPage<Rx>(r);
      setRows(rxPage.items);
      setTotal(rxPage.total);
      setLimit(rxPage.limit);
      setMeds(unwrapPage<Med>(m).items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setPatientId("");
    setDoctorId("");
    setRxNotes("");
    setDraftLines([emptyLine()]);
  };

  const create = async () => {
    if (!patientId || !doctorId) {
      setError("Select patient and doctor.");
      return;
    }
    const lines = draftLines.filter((l) => l.medicationId);
    if (!lines.length) {
      setError("Add at least one medication.");
      return;
    }
    if (lines.some((l) => !l.dosage.trim() || !l.frequency.trim() || !l.duration.trim())) {
      setError("Each line needs dose, how often, and for how long.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/pharmacy/prescriptions", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          prescribedByStaffId: doctorId,
          notes: rxNotes.trim() || undefined,
          lines: lines.map((l) => ({
            medicationId: l.medicationId,
            dosage: l.dosage.trim(),
            frequency: l.frequency.trim(),
            duration: l.duration.trim(),
            quantity: Number(l.quantity) || 1,
            instructions: l.instructions.trim() || undefined,
          })),
        }),
      });
      setOpen(false);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const dispense = async (id: string, lineIds?: string[]) => {
    try {
      await api(`/pharmacy/prescriptions/${id}/dispense`, {
        method: "POST",
        body: JSON.stringify(lineIds?.length ? { lineIds } : {}),
      });
      setDetail(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dispense failed");
    }
  };

  const openDetail = async (id: string) => {
    try {
      setDetail(await api<Rx>(`/pharmacy/prescriptions/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load prescription");
    }
  };

  const cancelRx = async () => {
    if (!cancelId) return;
    setBusy(true);
    try {
      await api(`/pharmacy/prescriptions/${cancelId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: cancelReason.trim() || undefined }),
      });
      setCancelId("");
      setCancelReason("");
      setDetail(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  };

  const voidRx = async () => {
    if (!voidId || !voidReason.trim()) {
      setError("Void reason is required.");
      return;
    }
    setBusy(true);
    try {
      await api(`/pharmacy/prescriptions/${voidId}/void`, {
        method: "POST",
        body: JSON.stringify({ voidReason: voidReason.trim() }),
      });
      setVoidId("");
      setVoidReason("");
      setDetail(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Void failed");
    } finally {
      setBusy(false);
    }
  };

  const meta = toPageMeta({ total, page, limit });

  return (
    <RoleGuard module="pharmacy">
      <PageHeader
        title="Prescriptions"
        subtitle={
          loading
            ? "Loading…"
            : `${total.toLocaleString()} prescriptions — doctor orders to dispense`
        }
        action={
          <PrimaryButton
            onClick={() => {
              setError("");
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New prescription
          </PrimaryButton>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className={`${inputClass} max-w-md`}
          placeholder="Search by patient name, MRN, or prescription number…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={`${inputClass} max-w-[200px]`}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PARTIALLY_DISPENSED">Partially dispensed</option>
          <option value="DISPENSED">Dispensed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>
      <Card>
        <CardHeader
          title="Dispense queue"
          subtitle="Pending orders from doctors (and walk-in Rx created here)"
        />
        <Table
          headers={[
            "Rx number",
            "Patient",
            "Prescribing doctor",
            "Medications to dispense",
            "Status",
            "",
          ]}
        >
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 font-medium text-slate-800">
                {r.prescriptionNumber || r.id.slice(0, 8)}
              </td>
              <td className="px-5 py-3.5 text-slate-500">
                {r.patientName}
                <span className="block text-xs text-slate-400">MRN {r.mrn}</span>
              </td>
              <td className="px-5 py-3.5 text-slate-500">{r.prescribedBy}</td>
              <td className="px-5 py-3.5 text-xs text-slate-500">
                {r.lines.map((l) => (
                  <div key={l.id}>
                    {l.medicationName} — qty {l.quantity} ({l.status.toLowerCase()})
                  </div>
                ))}
              </td>
              <td className="px-5 py-3.5">
                <Badge tone={r.status === "DISPENSED" ? "green" : "amber"}>
                  {r.isVoided ? "VOIDED" : r.status.replaceAll("_", " ")}
                </Badge>
              </td>
              <td className="px-5 py-3.5">
                <div className="flex items-center justify-end gap-1">
                  <TableAction icon={Eye} label="View" onClick={() => void openDetail(r.id)} />
                  {(r.status === "PENDING" || r.status === "PARTIALLY_DISPENSED") &&
                    !r.isVoided && (
                      <>
                        <button
                          type="button"
                          className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700"
                          onClick={() => void dispense(r.id)}
                        >
                          Dispense (FEFO)
                        </button>
                        <TableAction
                          icon={Ban}
                          label="Cancel"
                          tone="danger"
                          onClick={() => {
                            setCancelId(r.id);
                            setCancelReason("");
                          }}
                        />
                      </>
                    )}
                  {!r.isVoided && r.status !== "CANCELLED" && (
                    <button
                      type="button"
                      className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600"
                      onClick={() => {
                        setVoidId(r.id);
                        setVoidReason("");
                      }}
                    >
                      Void
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex justify-between">
              <h2 className="font-semibold text-slate-900">New prescription</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Use this for walk-in or paper scripts. Doctor consultations also create prescriptions
              automatically when they complete with medications.
            </p>
            <div>
              <FieldLabel required>Patient receiving the medicine</FieldLabel>
              <PatientSearchSelect value={patientId} onChange={(id) => setPatientId(id)} />
            </div>
            <div>
              <FieldLabel required>Doctor who wrote the script</FieldLabel>
              <DoctorSearchSelect value={doctorId} onChange={(id) => setDoctorId(id)} />
            </div>
            {draftLines.map((line, idx) => (
              <div key={idx} className="space-y-2 rounded-2xl bg-[#f3f7f7] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-slate-400">Line {idx + 1}</p>
                  {draftLines.length > 1 && (
                    <button
                      type="button"
                      className="text-xs text-rose-500"
                      onClick={() => setDraftLines((rows) => rows.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div>
                  <FieldLabel required>Medication from formulary</FieldLabel>
                  <select
                    className={inputClass}
                    value={line.medicationId}
                    onChange={(e) =>
                      setDraftLines((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, medicationId: e.target.value } : r)),
                      )
                    }
                  >
                    <option value="">Select medication…</option>
                    {meds.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.medicationName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel required>Dose</FieldLabel>
                  <input
                    className={inputClass}
                    value={line.dosage}
                    onChange={(e) =>
                      setDraftLines((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, dosage: e.target.value } : r)),
                      )
                    }
                    placeholder="e.g. 1 tablet, 500 mg, 5 ml"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel required>How often</FieldLabel>
                    <input
                      className={inputClass}
                      value={line.frequency}
                      onChange={(e) =>
                        setDraftLines((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, frequency: e.target.value } : r)),
                        )
                      }
                      placeholder="TDS"
                    />
                  </div>
                  <div>
                    <FieldLabel required>For how long</FieldLabel>
                    <input
                      className={inputClass}
                      value={line.duration}
                      onChange={(e) =>
                        setDraftLines((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, duration: e.target.value } : r)),
                        )
                      }
                      placeholder="5 days"
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel required>Quantity to dispense</FieldLabel>
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      setDraftLines((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, quantity: e.target.value } : r)),
                      )
                    }
                  />
                </div>
                <div>
                  <FieldLabel optional>Extra instructions</FieldLabel>
                  <input
                    className={inputClass}
                    value={line.instructions}
                    onChange={(e) =>
                      setDraftLines((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, instructions: e.target.value } : r)),
                      )
                    }
                    placeholder="e.g. Take after food"
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              className="text-xs font-semibold text-brand-700"
              onClick={() => setDraftLines((rows) => [...rows, emptyLine()])}
            >
              + Add another medication
            </button>
            <div>
              <FieldLabel optional>Notes</FieldLabel>
              <input className={inputClass} value={rxNotes} onChange={(e) => setRxNotes(e.target.value)} />
            </div>
            <PrimaryButton disabled={busy} onClick={() => void create()}>
              {busy ? "Saving…" : "Create prescription"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                {detail.prescriptionNumber || detail.id.slice(0, 8)}
              </h2>
              <button type="button" onClick={() => setDetail(null)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              {detail.patientName} · MRN {detail.mrn} · {detail.prescribedBy}
            </p>
            {detail.consultationId && (
              <p className="text-xs text-slate-500">
                Linked consult{" "}
                <Link href="/consultations" className="font-medium text-brand-700 hover:underline">
                  {detail.consultationId.slice(0, 8)}…
                </Link>
              </p>
            )}
            {detail.notes && <p className="text-sm text-slate-500">{detail.notes}</p>}
            {detail.isVoided && (
              <p className="text-sm text-rose-600">
                Voided{detail.voidReason ? `: ${detail.voidReason}` : ""}
                {detail.voidedByName ? ` · ${detail.voidedByName}` : ""}
              </p>
            )}
            <ul className="space-y-2">
              {detail.lines.map((l) => (
                <li key={l.id} className="rounded-xl bg-[#f3f7f7] px-3 py-2 text-sm">
                  <p className="font-medium text-slate-800">{l.medicationName}</p>
                  <p className="text-xs text-slate-500">
                    {l.dosage} · {l.frequency} · {l.duration} · qty {l.quantity} · {l.status}
                  </p>
                  {l.dispensedByName && (
                    <p className="text-xs text-slate-400">
                      Dispensed by {l.dispensedByName}
                      {l.dispensedAt ? ` · ${new Date(l.dispensedAt).toLocaleString()}` : ""}
                    </p>
                  )}
                  {l.instructions && <p className="text-xs text-slate-400">{l.instructions}</p>}
                </li>
              ))}
            </ul>
            {(detail.status === "PENDING" || detail.status === "PARTIALLY_DISPENSED") &&
              !detail.isVoided && (
                <PrimaryButton onClick={() => void dispense(detail.id)}>Dispense remaining (FEFO)</PrimaryButton>
              )}
          </div>
        </div>
      )}

      {cancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="font-semibold text-slate-900">Cancel prescription</h2>
            <div>
              <FieldLabel optional>Reason</FieldLabel>
              <input className={inputClass} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <PrimaryButton disabled={busy} onClick={() => void cancelRx()}>
                {busy ? "Cancelling…" : "Confirm cancel"}
              </PrimaryButton>
              <button type="button" className="text-sm text-slate-500" onClick={() => setCancelId("")}>
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {voidId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="font-semibold text-slate-900">Void prescription</h2>
            <p className="text-xs text-slate-500">Use void after a clinical or legal correction. Reason is required.</p>
            <div>
              <FieldLabel required>Void reason</FieldLabel>
              <input className={inputClass} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <PrimaryButton disabled={busy} onClick={() => void voidRx()}>
                {busy ? "Voiding…" : "Confirm void"}
              </PrimaryButton>
              <button type="button" className="text-sm text-slate-500" onClick={() => setVoidId("")}>
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
