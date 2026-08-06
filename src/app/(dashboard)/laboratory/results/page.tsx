"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

type ResultRow = {
  id: string;
  requestId: string;
  requestNumber: string | null;
  patientName: string | null;
  mrn: string | null;
  parameterName: string | null;
  testName: string | null;
  resultValue: string | null;
  interpretation: string | null;
  isCritical: boolean;
  isVerified: boolean;
  performedAt: string | null;
  verifiedAt: string | null;
};

export default function LabResultsPage() {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [error, setError] = useState("");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [unverifiedOnly, setUnverifiedOnly] = useState(false);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("critical") === "1") setCriticalOnly(true);
  }, []);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (criticalOnly) p.set("criticalOnly", "true");
    if (unverifiedOnly) p.set("unverifiedOnly", "true");
    return p.toString();
  }, [criticalOnly, unverifiedOnly]);

  const load = useCallback(async () => {
    try {
      const data = await api<{ items: ResultRow[] }>(`/laboratory/results?${qs}`);
      setRows(data.items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  const verify = async (r: ResultRow) => {
    setBusyId(r.id);
    try {
      await api(`/laboratory/requests/${r.requestId}/results/${r.id}/verify`, {
        method: "POST",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setBusyId("");
    }
  };

  const tone = (interp: string | null): BadgeTone => {
    if (interp === "CRITICAL") return "red";
    if (interp === "HIGH" || interp === "LOW") return "amber";
    return "green";
  };

  return (
    <RoleGuard module="laboratory">
      <PageHeader
        title="Results"
        subtitle="Entry history, verification, and critical flags"
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={criticalOnly}
            onChange={(e) => setCriticalOnly(e.target.checked)}
          />
          Critical only
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={unverifiedOnly}
            onChange={(e) => setUnverifiedOnly(e.target.checked)}
          />
          Unverified only
        </label>
      </div>
      <Card>
        <CardHeader title="Results" subtitle={`${rows.length} shown`} />
        <Table
          headers={[
            "Request",
            "Patient",
            "Parameter",
            "Value",
            "Interpretation",
            "Verified",
            "",
          ]}
        >
          {rows.map((r) => (
            <tr
              key={r.id}
              className={`hover:bg-slate-50/60 ${r.isCritical ? "bg-rose-50/40" : ""}`}
            >
              <td className="px-5 py-3.5 font-medium text-slate-800">
                {r.requestNumber}
              </td>
              <td className="px-5 py-3.5 text-slate-500">
                {r.patientName}
                <span className="block text-xs text-slate-400">{r.mrn}</span>
              </td>
              <td className="px-5 py-3.5 text-slate-500">
                {r.parameterName}
                <span className="block text-xs text-slate-400">{r.testName}</span>
              </td>
              <td className="px-5 py-3.5 text-slate-800">{r.resultValue}</td>
              <td className="px-5 py-3.5">
                <Badge tone={tone(r.interpretation)}>{r.interpretation}</Badge>
              </td>
              <td className="px-5 py-3.5">
                <Badge tone={r.isVerified ? "green" : "amber"}>
                  {r.isVerified ? "Verified" : "Pending"}
                </Badge>
              </td>
              <td className="px-5 py-3.5">
                {!r.isVerified && (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700 disabled:opacity-50"
                    onClick={() => void verify(r)}
                  >
                    {busyId === r.id ? "…" : "Verify"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 && (
          <p className="px-5 pb-5 text-sm text-slate-400">No results match filters.</p>
        )}
      </Card>
    </RoleGuard>
  );
}
