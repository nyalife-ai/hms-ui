"use client";

import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import {
  Badge,
  Card,
  CardHeader,
  PageHeader,
  Table,
  type BadgeTone,
} from "@/components/ui";
import { api } from "@/lib/api";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

const STATUS_TONE: Record<string, BadgeTone> = {
  REGISTERED: "amber",
  IN_PROGRESS: "teal",
  PENDING_RESULTS: "amber",
  COMPLETED: "green",
  CANCELLED: "slate",
};

const NEXT: Record<string, string[]> = {
  REGISTERED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["PENDING_RESULTS", "CANCELLED"],
  PENDING_RESULTS: ["COMPLETED", "CANCELLED"],
};

type Sample = {
  id: string;
  sampleId: string;
  requestNumber: string | null;
  patientName: string;
  mrn: string | null;
  sampleType: string;
  collectedAt: string;
  collectedByName: string | null;
  status: string;
};

export default function LabSamplesPage() {
  const [rows, setRows] = useState<Sample[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (search) qs.set("search", search);
      const data = await api<{ items: Sample[] }>(`/laboratory/samples?${qs}`);
      setRows(data.items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [status, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const advance = async (id: string, next: string) => {
    setBusyId(`${id}:${next}`);
    setError("");
    try {
      await api(`/laboratory/samples/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: next }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed");
      await load();
    } finally {
      setBusyId("");
    }
  };

  return (
    <RoleGuard module="laboratory">
      <PageHeader title="Samples" subtitle="Collection lifecycle" />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2">
        <input
          className={inputClass}
          placeholder="Search sample ID / type"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {["REGISTERED", "IN_PROGRESS", "PENDING_RESULTS", "COMPLETED", "CANCELLED"].map(
            (s) => (
              <option key={s} value={s}>{s}</option>
            ),
          )}
        </select>
      </div>
      <Card>
        <CardHeader title="Samples" subtitle={`${rows.length} shown`} />
        <Table headers={["Sample", "Request", "Patient", "Type", "Collected", "Status", ""]}>
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 font-medium text-slate-800">{s.sampleId}</td>
              <td className="px-5 py-3.5 text-slate-500">{s.requestNumber}</td>
              <td className="px-5 py-3.5 text-slate-500">
                {s.patientName}
                <span className="block text-xs text-slate-400">{s.mrn}</span>
              </td>
              <td className="px-5 py-3.5 text-slate-500">{s.sampleType}</td>
              <td className="px-5 py-3.5 text-xs text-slate-500">
                {s.collectedAt.slice(0, 16).replace("T", " ")}
                {s.collectedByName && (
                  <span className="block">{s.collectedByName}</span>
                )}
              </td>
              <td className="px-5 py-3.5">
                <Badge tone={STATUS_TONE[s.status] ?? "slate"}>{s.status}</Badge>
              </td>
              <td className="px-5 py-3.5">
                <div className="flex flex-wrap gap-1">
                  {(NEXT[s.status] ?? []).map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={Boolean(busyId)}
                      className="rounded-full border px-2 py-1 text-[10px] disabled:opacity-40"
                      onClick={() => void advance(s.id, n)}
                    >
                      {busyId === `${s.id}:${n}` ? "…" : `→ ${n}`}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 && (
          <p className="px-5 pb-5 text-sm text-slate-400">No samples match filters.</p>
        )}
      </Card>
    </RoleGuard>
  );
}
