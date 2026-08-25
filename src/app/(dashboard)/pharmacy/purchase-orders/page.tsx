"use client";

import { Ban, Eye, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FieldLabel } from "@/components/field-label";
import { PaginationBar } from "@/components/pagination-bar";
import { RoleGuard } from "@/components/role-guard";
import { TableAction } from "@/components/table-action";
import { Badge, Card, CardHeader, PageHeader, PrimaryButton, Table } from "@/components/ui";
import { api } from "@/lib/api";
import { buildListQuery, toPageMeta, unwrapPage } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type PO = {
  id: string;
  orderNumber: string;
  supplierName: string;
  status: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  notes?: string | null;
  createdByName?: string | null;
  lines: Array<{
    id: string;
    medicationName: string;
    quantityOrdered: number;
    receivedQuantity: number;
    unitCost?: number;
  }>;
};

type Supplier = { id: string; companyName: string };
type Med = { id: string; medicationName: string };
type PoDraftLine = { medicationId: string; quantity: string; unitCost: string };
type ReceiveDraft = { lineId: string; medicationName: string; remaining: number; quantity: string; batchNumber: string; expiry: string; mfgDate: string };

export default function PharmacyPurchaseOrdersPage() {
  const [rows, setRows] = useState<PO[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [meds, setMeds] = useState<Med[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [poLines, setPoLines] = useState<PoDraftLine[]>([
    { medicationId: "", quantity: "10", unitCost: "5" },
  ]);
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [receiveId, setReceiveId] = useState("");
  const [receiveDrafts, setReceiveDrafts] = useState<ReceiveDraft[]>([]);
  const [detail, setDetail] = useState<PO | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildListQuery({
        page,
        limit: 50,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      const [p, s, m] = await Promise.all([
        api(`/pharmacy/purchase-orders?${qs}`),
        api("/pharmacy/suppliers?active=true&limit=100"),
        api("/pharmacy/medications?limit=100"),
      ]);
      const poPage = unwrapPage<PO>(p);
      setRows(poPage.items);
      setTotal(poPage.total);
      setLimit(poPage.limit);
      setSuppliers(unwrapPage<Supplier>(s).items);
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

  const create = async () => {
    const lines = poLines.filter((l) => l.medicationId);
    if (!supplierId || !lines.length) {
      setError("Select a supplier and at least one medication.");
      return;
    }
    setBusy(true);
    try {
      await api("/pharmacy/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          supplierId,
          expectedDeliveryDate: expectedDelivery || undefined,
          notes: poNotes.trim() || undefined,
          lines: lines.map((l) => ({
            medicationId: l.medicationId,
            quantityOrdered: Number(l.quantity) || 1,
            unitCost: Number(l.unitCost) || 0,
          })),
        }),
      });
      setOpen(false);
      setPoLines([{ medicationId: "", quantity: "10", unitCost: "5" }]);
      setExpectedDelivery("");
      setPoNotes("");
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
    const receipts = receiveDrafts.filter((d) => Number(d.quantity) > 0 && d.batchNumber.trim());
    if (!receiveId || !receipts.length) {
      setError("Enter batch number and quantity for at least one line.");
      return;
    }
    setBusy(true);
    try {
      await api(`/pharmacy/purchase-orders/${receiveId}/receive`, {
        method: "POST",
        body: JSON.stringify({
          receipts: receipts.map((d) => ({
            lineId: d.lineId,
            quantity: Number(d.quantity),
            batchNumber: d.batchNumber.trim(),
            expiryDate: d.expiry,
            manufacturingDate: d.mfgDate || undefined,
          })),
        }),
      });
      setReceiveId("");
      setReceiveDrafts([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Receive failed");
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (id: string) => {
    try {
      setDetail(await api<PO>(`/pharmacy/purchase-orders/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load order");
    }
  };

  const cancelPo = async (id: string) => {
    if (!confirm("Cancel this purchase order?")) return;
    try {
      await api(`/pharmacy/purchase-orders/${id}/cancel`, { method: "POST" });
      setDetail(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    }
  };

  const meta = toPageMeta({ total, page, limit });

  return (
    <RoleGuard module="pharmacy">
      <PageHeader
        title="Purchase Orders"
        subtitle={loading ? "Loading…" : `${total.toLocaleString()} orders · Draft → Send → Receive`}
        action={
          <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New PO
          </PrimaryButton>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className={`${inputClass} max-w-md`}
          placeholder="Search order # or supplier…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={`${inputClass} max-w-[180px]`}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="RECEIVED">Received</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>
      <Card>
        <CardHeader title="Orders" subtitle={`${total.toLocaleString()} POs`} />
        <Table headers={["Order", "Supplier", "Date", "Status", "Lines", "Actions"]}>
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-surface-200/60">
              <td className="px-5 py-3.5 font-medium text-foreground">{p.orderNumber}</td>
              <td className="px-5 py-3.5 text-foreground-light">{p.supplierName}</td>
              <td className="px-5 py-3.5 text-foreground-light">{p.orderDate}</td>
              <td className="px-5 py-3.5">
                <Badge>{p.status}</Badge>
              </td>
              <td className="px-5 py-3.5 text-foreground-light text-xs">
                {p.lines.map((l) => (
                  <div key={l.id}>
                    {l.medicationName}: {l.receivedQuantity}/{l.quantityOrdered}
                  </div>
                ))}
              </td>
              <td className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-1">
                  <TableAction icon={Eye} label="View" onClick={() => void openDetail(p.id)} />
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
                        const stamp = Date.now().toString(36).toUpperCase();
                        setReceiveDrafts(
                          p.lines
                            .filter((l) => l.quantityOrdered - l.receivedQuantity > 0)
                            .map((l, i) => ({
                              lineId: l.id,
                              medicationName: l.medicationName,
                              remaining: l.quantityOrdered - l.receivedQuantity,
                              quantity: String(l.quantityOrdered - l.receivedQuantity),
                              batchNumber: `LOT-${stamp}-${i + 1}`,
                              expiry: "2027-12-01",
                              mfgDate: "",
                            })),
                        );
                      }}
                    >
                      Receive
                    </button>
                  )}
                  {(p.status === "DRAFT" || p.status === "SENT") && (
                    <TableAction
                      icon={Ban}
                      label="Cancel order"
                      tone="danger"
                      onClick={() => void cancelPo(p.id)}
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex justify-between">
              <h2 className="font-semibold">Create purchase order</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <FieldLabel required>Supplier</FieldLabel>
              <select className={inputClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.companyName}</option>
                ))}
              </select>
            </div>
            {poLines.map((line, idx) => (
              <div key={idx} className="space-y-2 rounded-2xl bg-[#f3f7f7] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-foreground-lighter">Line {idx + 1}</p>
                  {poLines.length > 1 && (
                    <button
                      type="button"
                      className="text-xs text-rose-500"
                      onClick={() => setPoLines((rows) => rows.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div>
                  <FieldLabel required>Medication</FieldLabel>
                  <select
                    className={inputClass}
                    value={line.medicationId}
                    onChange={(e) =>
                      setPoLines((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, medicationId: e.target.value } : r)),
                      )
                    }
                  >
                    <option value="">Select medication</option>
                    {meds.map((m) => (
                      <option key={m.id} value={m.id}>{m.medicationName}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel required>Quantity</FieldLabel>
                    <input
                      className={inputClass}
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) =>
                        setPoLines((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, quantity: e.target.value } : r)),
                        )
                      }
                    />
                  </div>
                  <div>
                    <FieldLabel optional>Unit cost</FieldLabel>
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      value={line.unitCost}
                      onChange={(e) =>
                        setPoLines((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, unitCost: e.target.value } : r)),
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="text-xs font-semibold text-brand-700"
              onClick={() =>
                setPoLines((rows) => [...rows, { medicationId: "", quantity: "10", unitCost: "5" }])
              }
            >
              + Add another line
            </button>
            <div>
              <FieldLabel optional>Expected delivery</FieldLabel>
              <input
                className={inputClass}
                type="date"
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel optional>Notes</FieldLabel>
              <input className={inputClass} value={poNotes} onChange={(e) => setPoNotes(e.target.value)} />
            </div>
            <PrimaryButton disabled={busy} onClick={create}>
              {busy ? "Saving…" : "Create draft"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {receiveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="font-semibold">Receive stock</h2>
            {receiveDrafts.length === 0 ? (
              <p className="text-sm text-foreground-lighter">Nothing remaining on this order.</p>
            ) : (
              receiveDrafts.map((d) => (
                <div key={d.lineId} className="space-y-2 rounded-2xl bg-[#f3f7f7] p-3">
                  <p className="text-sm font-medium text-foreground">
                    {d.medicationName} · remaining {d.remaining}
                  </p>
                  <div>
                    <FieldLabel required>Quantity</FieldLabel>
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      value={d.quantity}
                      onChange={(e) =>
                        setReceiveDrafts((rows) =>
                          rows.map((r) => (r.lineId === d.lineId ? { ...r, quantity: e.target.value } : r)),
                        )
                      }
                    />
                  </div>
                  <div>
                    <FieldLabel required>Batch number</FieldLabel>
                    <input
                      className={inputClass}
                      value={d.batchNumber}
                      onChange={(e) =>
                        setReceiveDrafts((rows) =>
                          rows.map((r) => (r.lineId === d.lineId ? { ...r, batchNumber: e.target.value } : r)),
                        )
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <FieldLabel required>Expiry</FieldLabel>
                      <input
                        className={inputClass}
                        type="date"
                        value={d.expiry}
                        onChange={(e) =>
                          setReceiveDrafts((rows) =>
                            rows.map((r) => (r.lineId === d.lineId ? { ...r, expiry: e.target.value } : r)),
                          )
                        }
                      />
                    </div>
                    <div>
                      <FieldLabel optional>Mfg date</FieldLabel>
                      <input
                        className={inputClass}
                        type="date"
                        value={d.mfgDate}
                        onChange={(e) =>
                          setReceiveDrafts((rows) =>
                            rows.map((r) => (r.lineId === d.lineId ? { ...r, mfgDate: e.target.value } : r)),
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
            <PrimaryButton disabled={busy} onClick={receive}>
              {busy ? "Receiving…" : "Confirm receive"}
            </PrimaryButton>
            <button type="button" className="text-sm text-foreground-light" onClick={() => setReceiveId("")}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">{detail.orderNumber}</h2>
              <button type="button" onClick={() => setDetail(null)}>
                <X className="h-4 w-4 text-foreground-lighter" />
              </button>
            </div>
            <p className="text-sm text-foreground-light">
              {detail.supplierName} · {detail.orderDate} · {detail.status}
            </p>
            {detail.expectedDeliveryDate && (
              <p className="text-xs text-foreground-light">Expected {detail.expectedDeliveryDate}</p>
            )}
            {detail.createdByName && (
              <p className="text-xs text-foreground-light">Created by {detail.createdByName}</p>
            )}
            {detail.notes && <p className="text-sm text-foreground-light">{detail.notes}</p>}
            <ul className="space-y-2">
              {detail.lines.map((l) => (
                <li key={l.id} className="rounded-xl bg-[#f3f7f7] px-3 py-2 text-sm">
                  {l.medicationName}: {l.receivedQuantity}/{l.quantityOrdered}
                  {l.unitCost != null ? ` · KES ${l.unitCost}` : ""}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {detail.status === "DRAFT" && (
                <PrimaryButton onClick={() => void send(detail.id)}>Send to supplier</PrimaryButton>
              )}
              {(detail.status === "DRAFT" || detail.status === "SENT") && (
                <button
                  type="button"
                  className="rounded-full border border-rose-200 px-4 py-2 text-xs text-rose-600"
                  onClick={() => void cancelPo(detail.id)}
                >
                  Cancel order
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
