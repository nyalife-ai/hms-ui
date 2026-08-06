"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import { Badge, Card, CardHeader, PageHeader, PrimaryButton, Table } from "@/components/ui";
import { api } from "@/lib/api";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type PO = {
  id: string;
  orderNumber: string;
  supplierName: string;
  status: string;
  orderDate: string;
  lines: Array<{
    id: string;
    medicationName: string;
    quantityOrdered: number;
    receivedQuantity: number;
  }>;
};

type Supplier = { id: string; companyName: string };
type Med = { id: string; medicationName: string };

export default function PharmacyPurchaseOrdersPage() {
  const [rows, setRows] = useState<PO[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [meds, setMeds] = useState<Med[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [medicationId, setMedicationId] = useState("");
  const [qty, setQty] = useState("10");
  const [unitCost, setUnitCost] = useState("5");
  const [receiveId, setReceiveId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiry, setExpiry] = useState("2027-12-01");

  const load = useCallback(async () => {
    try {
      const [p, s, m] = await Promise.all([
        api<PO[]>("/pharmacy/purchase-orders"),
        api<Supplier[]>("/pharmacy/suppliers?active=true"),
        api<Med[]>("/pharmacy/medications"),
      ]);
      setRows(p);
      setSuppliers(s);
      setMeds(m);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!supplierId || !medicationId) return;
    setBusy(true);
    try {
      await api("/pharmacy/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          supplierId,
          lines: [
            {
              medicationId,
              quantityOrdered: Number(qty) || 1,
              unitCost: Number(unitCost) || 0,
            },
          ],
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

  const send = async (id: string) => {
    try {
      await api(`/pharmacy/purchase-orders/${id}/send`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    }
  };

  const receive = async () => {
    const po = rows.find((r) => r.id === receiveId);
    if (!po?.lines[0] || !batchNumber.trim()) return;
    setBusy(true);
    try {
      await api(`/pharmacy/purchase-orders/${receiveId}/receive`, {
        method: "POST",
        body: JSON.stringify({
          receipts: [
            {
              lineId: po.lines[0].id,
              quantity: po.lines[0].quantityOrdered - po.lines[0].receivedQuantity,
              batchNumber: batchNumber.trim(),
              expiryDate: expiry,
            },
          ],
        }),
      });
      setReceiveId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Receive failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <RoleGuard module="pharmacy">
      <PageHeader
        title="Purchase Orders"
        subtitle="Draft → Send → Receive"
        action={
          <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New PO
          </PrimaryButton>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <Card>
        <CardHeader title="Orders" subtitle={`${rows.length} POs`} />
        <Table headers={["Order", "Supplier", "Date", "Status", "Lines", "Actions"]}>
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 font-medium text-slate-800">{p.orderNumber}</td>
              <td className="px-5 py-3.5 text-slate-500">{p.supplierName}</td>
              <td className="px-5 py-3.5 text-slate-500">{p.orderDate}</td>
              <td className="px-5 py-3.5">
                <Badge>{p.status}</Badge>
              </td>
              <td className="px-5 py-3.5 text-slate-500 text-xs">
                {p.lines.map((l) => (
                  <div key={l.id}>
                    {l.medicationName}: {l.receivedQuantity}/{l.quantityOrdered}
                  </div>
                ))}
              </td>
              <td className="px-5 py-3.5">
                <div className="flex flex-wrap gap-2">
                  {p.status === "DRAFT" && (
                    <button
                      type="button"
                      className="rounded-full border px-3 py-1 text-xs"
                      onClick={() => void send(p.id)}
                    >
                      Send
                    </button>
                  )}
                  {(p.status === "SENT" || p.status === "DRAFT") && (
                    <button
                      type="button"
                      className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700"
                      onClick={() => {
                        setReceiveId(p.id);
                        setBatchNumber(`LOT-${Date.now().toString(36).toUpperCase()}`);
                      }}
                    >
                      Receive
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex justify-between">
              <h2 className="font-semibold">Create purchase order</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <select className={inputClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.companyName}</option>
              ))}
            </select>
            <select className={inputClass} value={medicationId} onChange={(e) => setMedicationId(e.target.value)}>
              <option value="">Medication</option>
              {meds.map((m) => (
                <option key={m.id} value={m.id}>{m.medicationName}</option>
              ))}
            </select>
            <input className={inputClass} type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" />
            <input className={inputClass} type="number" min={0} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="Unit cost" />
            <PrimaryButton disabled={busy} onClick={create}>
              {busy ? "Saving…" : "Create draft"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {receiveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="font-semibold">Receive stock</h2>
            <input className={inputClass} placeholder="Batch number" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
            <input className={inputClass} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            <PrimaryButton disabled={busy} onClick={receive}>
              {busy ? "Receiving…" : "Confirm receive"}
            </PrimaryButton>
            <button type="button" className="text-sm text-slate-500" onClick={() => setReceiveId("")}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
