"use client";

import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import { Badge, Card, CardHeader, PageHeader, PrimaryButton, Table } from "@/components/ui";
import { api } from "@/lib/api";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type Batch = {
  id: string;
  medicationName: string | null;
  batchNumber: string;
  quantityOnHand: number;
  expiryDate: string;
  expired: boolean;
  supplierName: string | null;
};

export default function PharmacyBatchesPage() {
  const [rows, setRows] = useState<Batch[]>([]);
  const [error, setError] = useState("");
  const [damageId, setDamageId] = useState("");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<Batch[]>("/pharmacy/batches?withStock=true");
      setRows(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load batches");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const damage = async () => {
    if (!damageId || !reason.trim()) return;
    setBusy(true);
    try {
      await api("/pharmacy/stock/damage", {
        method: "POST",
        body: JSON.stringify({
          batchId: damageId,
          quantity: Number(qty) || 1,
          reason,
        }),
      });
      setDamageId("");
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Damage failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <RoleGuard module="pharmacy">
      <PageHeader title="Batches" subtitle="Lot-level stock from /pharmacy/batches" />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <Card>
        <CardHeader title="On-hand batches" subtitle={`${rows.length} lots`} />
        <Table headers={["Medication", "Batch", "Qty", "Expiry", "Supplier", "Actions"]}>
          {rows.map((b) => (
            <tr key={b.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 font-medium text-slate-800">{b.medicationName}</td>
              <td className="px-5 py-3.5 text-slate-500">{b.batchNumber}</td>
              <td className="px-5 py-3.5 text-slate-500">{b.quantityOnHand}</td>
              <td className="px-5 py-3.5">
                <Badge tone={b.expired ? "red" : "green"}>{b.expiryDate}</Badge>
              </td>
              <td className="px-5 py-3.5 text-slate-500">{b.supplierName || "—"}</td>
              <td className="px-5 py-3.5">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                  onClick={() => {
                    setDamageId(b.id);
                    setQty("1");
                    setReason("");
                  }}
                >
                  Damage
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {damageId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="font-semibold text-slate-900">Record damage</h2>
            <input className={inputClass} type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
            <input className={inputClass} placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex gap-2">
              <PrimaryButton disabled={busy} onClick={damage}>
                {busy ? "Saving…" : "Confirm"}
              </PrimaryButton>
              <button type="button" className="text-sm text-slate-500" onClick={() => setDamageId("")}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
