"use client";

import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import {
  Badge,
  Card,
  CardHeader,
  PageHeader,
  PrimaryButton,
  Table,
  type BadgeTone,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useDoctors, usePatients } from "@/lib/catalog";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "amber",
  IN_PROGRESS: "teal",
  COMPLETED: "green",
  CANCELLED: "slate",
};

const PRIORITY_TONE: Record<string, BadgeTone> = {
  NORMAL: "slate",
  URGENT: "amber",
  STAT: "red",
};

type RequestRow = {
  id: string;
  requestNumber: string | null;
  patientName: string;
  mrn: string | null;
  requestingDoctor: string | null;
  priority: string;
  status: string;
  requestDate: string;
};

type TestType = { id: string; testName: string };

type RequestDetail = RequestRow & {
  patientId: string;
  notes: string | null;
  resultEntryParameters: Array<{
    id: string;
    parameterName: string;
    unitOfMeasurement: string | null;
    normalReferenceRange: string | null;
    testName: string;
  }>;
  samples: Array<{ id: string; sampleId: string; status: string; sampleType: string }>;
  results: Array<{
    id: string;
    parameterName: string | null;
    resultValue: string | null;
    interpretation: string | null;
    isVerified: boolean;
    isCritical: boolean;
  }>;
};

export default function LabRequestsPage() {
  const { data: patients } = usePatients();
  const { data: doctors } = useDoctors();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [types, setTypes] = useState<TestType[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [testTypeId, setTestTypeId] = useState("");
  const [reqPriority, setReqPriority] = useState("NORMAL");
  const [resultValues, setResultValues] = useState<Record<string, string>>({});
  const [interpretations, setInterpretations] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (priority) qs.set("priority", priority);
      if (search) qs.set("search", search);
      const [r, t] = await Promise.all([
        api<{ items: RequestRow[] }>(`/laboratory/requests?${qs}`),
        api<{ items: TestType[] }>("/laboratory/test-types?active=true"),
      ]);
      setRows(r.items);
      setTypes(t.items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [status, priority, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!patientId || !testTypeId) return;
    setBusy(true);
    try {
      await api("/laboratory/requests", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          requestingDoctorId: doctorId || undefined,
          testTypeIds: [testTypeId],
          priority: reqPriority,
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

  const openDetail = async (id: string) => {
    try {
      const d = await api<RequestDetail>(`/laboratory/requests/${id}`);
      setDetail(d);
      const vals: Record<string, string> = {};
      const ints: Record<string, string> = {};
      for (const p of d.resultEntryParameters) {
        const existing = d.results.find((r) => r.parameterName === p.parameterName);
        vals[p.id] = existing?.resultValue ?? "";
        ints[p.id] = existing?.interpretation ?? "NORMAL";
      }
      setResultValues(vals);
      setInterpretations(ints);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open request");
    }
  };

  const registerSample = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await api(`/laboratory/requests/${detail.id}/samples`, {
        method: "POST",
        body: JSON.stringify({ sampleType: "BLOOD" }),
      });
      await openDetail(detail.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sample failed");
    } finally {
      setBusy(false);
    }
  };

  const saveResults = async () => {
    if (!detail) return;
    const lines = detail.resultEntryParameters
      .filter((p) => (resultValues[p.id] || "").trim())
      .map((p) => ({
        parameterId: p.id,
        resultValue: resultValues[p.id],
        interpretation: interpretations[p.id] || "NORMAL",
      }));
    if (!lines.length) return;
    setBusy(true);
    try {
      await api(`/laboratory/requests/${detail.id}/results`, {
        method: "POST",
        body: JSON.stringify({ lines }),
      });
      await openDetail(detail.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Results failed");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (resultId: string) => {
    if (!detail) return;
    setBusy(true);
    try {
      await api(`/laboratory/requests/${detail.id}/results/${resultId}/verify`, {
        method: "POST",
      });
      await openDetail(detail.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    try {
      await api(`/laboratory/requests/${id}/cancel`, { method: "POST" });
      await load();
      if (detail?.id === id) setDetail(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    }
  };

  return (
    <RoleGuard module="laboratory">
      <PageHeader
        title="Lab Requests"
        subtitle="Order → sample → results → verify"
        action={
          <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New request
          </PrimaryButton>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3">
        <input className={inputClass} placeholder="Search request # / MRN" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">All priorities</option>
          {["NORMAL", "URGENT", "STAT"].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardHeader title="Requests" subtitle={`${rows.length} shown`} />
        <Table headers={["Request", "Patient", "Doctor", "Priority", "Status", "Date", ""]}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 font-medium text-slate-800">{r.requestNumber}</td>
              <td className="px-5 py-3.5 text-slate-500">
                {r.patientName}
                <span className="block text-xs text-slate-400">{r.mrn}</span>
              </td>
              <td className="px-5 py-3.5 text-slate-500">{r.requestingDoctor || "—"}</td>
              <td className="px-5 py-3.5">
                <Badge tone={PRIORITY_TONE[r.priority] ?? "slate"}>{r.priority}</Badge>
              </td>
              <td className="px-5 py-3.5">
                <Badge tone={STATUS_TONE[r.status] ?? "slate"}>{r.status}</Badge>
              </td>
              <td className="px-5 py-3.5 text-slate-500 text-xs">
                {r.requestDate.slice(0, 10)}
              </td>
              <td className="px-5 py-3.5">
                <div className="flex gap-2">
                  <button type="button" className="rounded-full border px-3 py-1 text-xs" onClick={() => void openDetail(r.id)}>
                    Open
                  </button>
                  {(r.status === "PENDING" || r.status === "IN_PROGRESS") && (
                    <button type="button" className="rounded-full border px-3 py-1 text-xs text-rose-600" onClick={() => void cancel(r.id)}>
                      Cancel
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 && (
          <p className="px-5 pb-5 text-sm text-slate-400">No requests match filters.</p>
        )}
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex justify-between">
              <h2 className="font-semibold">New lab request</h2>
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
              <option value="">Requesting doctor (optional)</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select className={inputClass} value={testTypeId} onChange={(e) => setTestTypeId(e.target.value)}>
              <option value="">Test type</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.testName}</option>
              ))}
            </select>
            <select className={inputClass} value={reqPriority} onChange={(e) => setReqPriority(e.target.value)}>
              {["NORMAL", "URGENT", "STAT"].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <PrimaryButton disabled={busy} onClick={create}>
              {busy ? "Saving…" : "Create"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex justify-between">
              <div>
                <h2 className="font-semibold">{detail.requestNumber}</h2>
                <p className="text-sm text-slate-500">
                  {detail.patientName} · {detail.mrn} · {detail.priority} · {detail.status}
                </p>
              </div>
              <button type="button" onClick={() => setDetail(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Samples</h3>
                {detail.status !== "COMPLETED" && detail.status !== "CANCELLED" && (
                  <button type="button" className="text-xs text-brand-600" onClick={() => void registerSample()}>
                    Register sample
                  </button>
                )}
              </div>
              {detail.samples.length === 0 ? (
                <p className="text-xs text-slate-400">No samples yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {detail.samples.map((s) => (
                    <li key={s.id}>
                      {s.sampleId} · {s.sampleType} · {s.status}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {detail.resultEntryParameters.length > 0 && detail.status !== "CANCELLED" && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Result entry</h3>
                <div className="space-y-3">
                  {detail.resultEntryParameters.map((p) => (
                    <div key={p.id} className="rounded-xl bg-slate-50 p-3">
                      <p className="text-sm font-medium">
                        {p.parameterName}{" "}
                        <span className="text-xs text-slate-400">
                          ({p.testName} · {p.unitOfMeasurement || "—"} · ref {p.normalReferenceRange || "—"})
                        </span>
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <input
                          className={inputClass}
                          placeholder="Result"
                          value={resultValues[p.id] ?? ""}
                          onChange={(e) =>
                            setResultValues((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          disabled={detail.status === "COMPLETED"}
                        />
                        <select
                          className={inputClass}
                          value={interpretations[p.id] ?? "NORMAL"}
                          onChange={(e) =>
                            setInterpretations((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          disabled={detail.status === "COMPLETED"}
                        >
                          {["NORMAL", "HIGH", "LOW", "CRITICAL"].map((i) => (
                            <option key={i} value={i}>{i}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
                {detail.status !== "COMPLETED" && (
                  <div className="mt-3">
                    <PrimaryButton disabled={busy} onClick={saveResults}>
                      {busy ? "Saving…" : "Save results"}
                    </PrimaryButton>
                  </div>
                )}
              </div>
            )}

            <div>
              <h3 className="mb-2 text-sm font-semibold">Entered results</h3>
              {detail.results.length === 0 ? (
                <p className="text-xs text-slate-400">None yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {detail.results.map((r) => (
                    <li key={r.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                      <span>
                        {r.parameterName}: {r.resultValue}{" "}
                        <Badge tone={r.isCritical ? "red" : "slate"}>{r.interpretation}</Badge>
                      </span>
                      {r.isVerified ? (
                        <Badge tone="green">Verified</Badge>
                      ) : (
                        <button
                          type="button"
                          className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700"
                          onClick={() => void verify(r.id)}
                        >
                          Verify
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Link href="/laboratory/samples" className="text-xs text-brand-600">
              Open samples board →
            </Link>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
