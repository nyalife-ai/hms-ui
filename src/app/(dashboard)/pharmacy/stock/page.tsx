"use client";

import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import { Badge, Card, CardHeader, PageHeader, Table } from "@/components/ui";
import { api } from "@/lib/api";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type Movement = {
  id: string;
  batchId: string;
  batchNumber: string;
  medicationName: string;
  movementType: string;
  quantityChange: number;
  referenceType: string | null;
  performedByName?: string | null;
  notes: string | null;
  createdAt: string;
};

const TYPES = ["", "RECEIVE", "DISPENSE", "ADJUSTMENT", "DAMAGE", "EXPIRY", "RETURN"];

export default function PharmacyStockPage() {
  const [rows, setRows] = useState<Movement[]>([]);
  const [type, setType] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = type ? `?movementType=${encodeURIComponent(type)}` : "";
      const data = await api<Movement[]>(`/pharmacy/stock/movements${qs}`);
      setRows(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stock ledger");
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <RoleGuard module="pharmacy">
      <PageHeader
        title="Stock movements"
        subtitle={loading ? "Loading…" : `${rows.length} recent ledger rows`}
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <div className="mb-4 max-w-xs">
        <select
          className={inputClass}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {TYPES.map((t) => (
            <option key={t || "all"} value={t}>
              {t || "All movement types"}
            </option>
          ))}
        </select>
      </div>
      <Card>
        <CardHeader title="Ledger" subtitle="Receives, dispenses, adjustments, damage, expiry, returns" />
        <Table headers={["When", "Medication", "Batch", "Type", "Qty", "Ref", "By", "Notes"]}>
          {rows.map((m) => (
            <tr key={m.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 text-xs text-slate-500">
                {new Date(m.createdAt).toLocaleString()}
              </td>
              <td className="px-5 py-3.5 font-medium text-slate-800">{m.medicationName}</td>
              <td className="px-5 py-3.5 text-slate-500">{m.batchNumber}</td>
              <td className="px-5 py-3.5">
                <Badge tone={m.quantityChange < 0 ? "amber" : "green"}>{m.movementType}</Badge>
              </td>
              <td className="px-5 py-3.5 text-slate-600">{m.quantityChange}</td>
              <td className="px-5 py-3.5 text-xs text-slate-500">{m.referenceType || "—"}</td>
              <td className="px-5 py-3.5 text-xs text-slate-500">{m.performedByName || "—"}</td>
              <td className="px-5 py-3.5 text-xs text-slate-500">{m.notes || "—"}</td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 && !loading && (
          <p className="px-5 pb-5 text-sm text-slate-400">No movements recorded yet.</p>
        )}
      </Card>
    </RoleGuard>
  );
}
