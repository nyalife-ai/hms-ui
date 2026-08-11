"use client";

import { Eye, Pencil, Plus, RotateCcw, SlidersHorizontal, Trash2, X } from "lucide-react";
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
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type Batch = {
  id: string;
  medicationId: string;
  medicationName: string | null;
  batchNumber: string;
  quantityOnHand: number;
  unitCost: number;
  sellingPrice: number;
  manufacturingDate: string | null;
  expiryDate: string;
  expired: boolean;
  supplierId: string | null;
  supplierName: string | null;
  notes: string | null;
  createdByName?: string | null;
};

type Med = { id: string; medicationName: string };
type Supplier = { id: string; companyName: string };
type Movement = {
  id: string;
  movementType: string;
  quantityChange: number;
  notes: string | null;
  createdAt: string;
};

type StockModal =
  | { kind: "damage"; batch: Batch }
  | { kind: "adjust"; batch: Batch }
  | { kind: "return"; batch: Batch }
  | { kind: "expiry"; batch: Batch };

const emptyCreate = {
  medicationId: "",
  supplierId: "",
  batchNumber: "",
  quantityOnHand: "",
  unitCost: "",
  sellingPrice: "",
  manufacturingDate: "",
  expiryDate: "",
  notes: "",
};

export default function PharmacyBatchesPage() {
  const [rows, setRows] = useState<Batch[]>([]);
  const [meds, setMeds] = useState<Med[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const [expiredOnly, setExpiredOnly] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<Batch | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [edit, setEdit] = useState<Batch | null>(null);
  const [editForm, setEditForm] = useState({ notes: "", sellingPrice: "", unitCost: "" });
  const [stock, setStock] = useState<StockModal | null>(null);
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildListQuery({
        withStock: true,
        expiredOnly: expiredOnly || undefined,
        page,
        limit: 50,
        search: search || undefined,
      });
      const [batchRes, medRes, supRes] = await Promise.all([
        api(`/pharmacy/batches?${qs}`),
        api("/pharmacy/medications?limit=100&active=true"),
        api("/pharmacy/suppliers?active=true&limit=100"),
      ]);
      const res = unwrapPage<Batch>(batchRes);
      setRows(res.items);
      setTotal(res.total);
      setLimit(res.limit);
      setMeds(unwrapPage<Med>(medRes).items);
      setSuppliers(unwrapPage<Supplier>(supRes).items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load batches");
    } finally {
      setLoading(false);
    }
  }, [page, search, expiredOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (row: Batch) => {
    try {
      const [b, m] = await Promise.all([
        api<Batch>(`/pharmacy/batches/${row.id}`),
        api<Movement[]>(`/pharmacy/stock/movements?batchId=${row.id}`),
      ]);
      setDetail(b);
      setMovements(Array.isArray(m) ? m : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load batch");
    }
  };

  const create = async () => {
    if (!createForm.medicationId || !createForm.batchNumber.trim() || !createForm.expiryDate) {
      setError("Medication, batch number, and expiry are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/pharmacy/batches", {
        method: "POST",
        body: JSON.stringify({
          medicationId: createForm.medicationId,
          batchNumber: createForm.batchNumber.trim(),
          quantityOnHand: Number(createForm.quantityOnHand) || 0,
          unitCost: createForm.unitCost ? Number(createForm.unitCost) : undefined,
          sellingPrice: createForm.sellingPrice ? Number(createForm.sellingPrice) : undefined,
          manufacturingDate: createForm.manufacturingDate || undefined,
          expiryDate: createForm.expiryDate,
          supplierId: createForm.supplierId || undefined,
          notes: createForm.notes.trim() || undefined,
        }),
      });
      setCreateOpen(false);
      setCreateForm(emptyCreate);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const saveMeta = async () => {
    if (!edit) return;
    setBusy(true);
    setError("");
    try {
      await api(`/pharmacy/batches/${edit.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          notes: editForm.notes.trim() || undefined,
          sellingPrice: editForm.sellingPrice ? Number(editForm.sellingPrice) : undefined,
          unitCost: editForm.unitCost ? Number(editForm.unitCost) : undefined,
        }),
      });
      setEdit(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const submitStock = async () => {
    if (!stock) return;
    setBusy(true);
    setError("");
    try {
      if (stock.kind === "damage") {
        if (!reason.trim()) {
          setError("Reason is required.");
          setBusy(false);
          return;
        }
        await api("/pharmacy/stock/damage", {
          method: "POST",
          body: JSON.stringify({
            batchId: stock.batch.id,
            quantity: Number(qty) || 1,
            reason,
          }),
        });
      } else if (stock.kind === "adjust") {
        if (!reason.trim() || !qty || Number(qty) === 0) {
          setError("Non-zero quantity change and reason are required.");
          setBusy(false);
          return;
        }
        await api("/pharmacy/stock/adjust", {
          method: "POST",
          body: JSON.stringify({
            batchId: stock.batch.id,
            quantityChange: Number(qty),
            reason,
          }),
        });
      } else if (stock.kind === "return") {
        if (!reason.trim()) {
          setError("Reason is required.");
          setBusy(false);
          return;
        }
        await api("/pharmacy/stock/return", {
          method: "POST",
          body: JSON.stringify({
            batchId: stock.batch.id,
            quantity: Number(qty) || 1,
            reason,
          }),
        });
      } else {
        await api("/pharmacy/stock/expiry", {
          method: "POST",
          body: JSON.stringify({
            batchId: stock.batch.id,
            quantity: qty ? Number(qty) : undefined,
            notes: reason.trim() || undefined,
          }),
        });
      }
      setStock(null);
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stock action failed");
    } finally {
      setBusy(false);
    }
  };

  const meta = toPageMeta({ total, page, limit });

  return (
    <RoleGuard module="pharmacy">
      <PageHeader
        title="Batches"
        subtitle={loading ? "Loading…" : `${total.toLocaleString()} lots`}
        action={
          <PrimaryButton
            onClick={() => {
              setError("");
              setCreateForm(emptyCreate);
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Receive lot
          </PrimaryButton>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className={`${inputClass} max-w-md`}
          placeholder="Search batch or medication…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={expiredOnly}
            onChange={(e) => {
              setExpiredOnly(e.target.checked);
              setPage(1);
            }}
          />
          Expired only
        </label>
      </div>
      <Card>
        <CardHeader title="On-hand batches" subtitle={`${total.toLocaleString()} lots`} />
        <Table headers={["Medication", "Batch", "Qty", "Expiry", "Supplier", ""]}>
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
                <div className="flex justify-end gap-0.5">
                  <TableAction icon={Eye} label="View" onClick={() => void openDetail(b)} />
                  <TableAction
                    icon={Pencil}
                    label="Edit notes / prices"
                    tone="edit"
                    onClick={() => {
                      setEdit(b);
                      setEditForm({
                        notes: b.notes ?? "",
                        sellingPrice: String(b.sellingPrice ?? ""),
                        unitCost: String(b.unitCost ?? ""),
                      });
                    }}
                  />
                  <TableAction
                    icon={SlidersHorizontal}
                    label="Adjust stock"
                    onClick={() => {
                      setStock({ kind: "adjust", batch: b });
                      setQty("1");
                      setReason("");
                    }}
                  />
                  <TableAction
                    icon={RotateCcw}
                    label="Return to stock"
                    tone="add"
                    onClick={() => {
                      setStock({ kind: "return", batch: b });
                      setQty("1");
                      setReason("");
                    }}
                  />
                  <TableAction
                    icon={Trash2}
                    label="Record damage"
                    tone="danger"
                    onClick={() => {
                      setStock({ kind: "damage", batch: b });
                      setQty("1");
                      setReason("");
                    }}
                  />
                  {b.expired && b.quantityOnHand > 0 && (
                    <button
                      type="button"
                      className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600"
                      onClick={() => {
                        setStock({ kind: "expiry", batch: b });
                        setQty(String(b.quantityOnHand));
                        setReason("Expired stock write-off");
                      }}
                    >
                      Write off
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </Card>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Receive lot</h2>
              <button type="button" onClick={() => setCreateOpen(false)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div>
              <FieldLabel required>Medication</FieldLabel>
              <select
                className={inputClass}
                value={createForm.medicationId}
                onChange={(e) => setCreateForm((f) => ({ ...f, medicationId: e.target.value }))}
              >
                <option value="">Select medication</option>
                {meds.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.medicationName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel required>Batch number</FieldLabel>
              <input
                className={inputClass}
                value={createForm.batchNumber}
                onChange={(e) => setCreateForm((f) => ({ ...f, batchNumber: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel required>Quantity</FieldLabel>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={createForm.quantityOnHand}
                  onChange={(e) => setCreateForm((f) => ({ ...f, quantityOnHand: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel required>Expiry</FieldLabel>
                <input
                  className={inputClass}
                  type="date"
                  value={createForm.expiryDate}
                  onChange={(e) => setCreateForm((f) => ({ ...f, expiryDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel optional>Unit cost</FieldLabel>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={createForm.unitCost}
                  onChange={(e) => setCreateForm((f) => ({ ...f, unitCost: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel optional>Selling price</FieldLabel>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={createForm.sellingPrice}
                  onChange={(e) => setCreateForm((f) => ({ ...f, sellingPrice: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <FieldLabel optional>Manufacturing date</FieldLabel>
              <input
                className={inputClass}
                type="date"
                value={createForm.manufacturingDate}
                onChange={(e) => setCreateForm((f) => ({ ...f, manufacturingDate: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel optional>Supplier</FieldLabel>
              <select
                className={inputClass}
                value={createForm.supplierId}
                onChange={(e) => setCreateForm((f) => ({ ...f, supplierId: e.target.value }))}
              >
                <option value="">None</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel optional>Notes</FieldLabel>
              <input
                className={inputClass}
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <PrimaryButton disabled={busy} onClick={() => void create()}>
              {busy ? "Saving…" : "Create lot"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Edit {edit.batchNumber}</h2>
              <button type="button" onClick={() => setEdit(null)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <p className="text-xs text-slate-400">Quantity is changed via adjust / damage / return / expiry.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel optional>Unit cost</FieldLabel>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={editForm.unitCost}
                  onChange={(e) => setEditForm((f) => ({ ...f, unitCost: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel optional>Selling price</FieldLabel>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={editForm.sellingPrice}
                  onChange={(e) => setEditForm((f) => ({ ...f, sellingPrice: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <FieldLabel optional>Notes</FieldLabel>
              <input
                className={inputClass}
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <PrimaryButton disabled={busy} onClick={() => void saveMeta()}>
              {busy ? "Saving…" : "Save"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {stock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="font-semibold text-slate-900">
              {stock.kind === "damage" && "Record damage"}
              {stock.kind === "adjust" && "Adjust stock"}
              {stock.kind === "return" && "Return to stock"}
              {stock.kind === "expiry" && "Write off expired stock"}
            </h2>
            <p className="text-xs text-slate-500">
              {stock.batch.medicationName} · {stock.batch.batchNumber} · on hand{" "}
              {stock.batch.quantityOnHand}
            </p>
            <div>
              <FieldLabel required>
                {stock.kind === "adjust" ? "Quantity change (+/−)" : "Quantity"}
              </FieldLabel>
              <input
                className={inputClass}
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel required={stock.kind !== "expiry"}>
                {stock.kind === "expiry" ? "Notes" : "Reason"}
              </FieldLabel>
              <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <PrimaryButton disabled={busy} onClick={() => void submitStock()}>
                {busy ? "Saving…" : "Confirm"}
              </PrimaryButton>
              <button type="button" className="text-sm text-slate-500" onClick={() => setStock(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">{detail.batchNumber}</h2>
              <button type="button" onClick={() => setDetail(null)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              {detail.medicationName} · {detail.quantityOnHand} on hand · exp {detail.expiryDate}
              {detail.expired ? " · expired" : ""}
            </p>
            <p className="text-xs text-slate-500">
              Cost KES {Number(detail.unitCost || 0).toLocaleString()} · Sell KES{" "}
              {Number(detail.sellingPrice || 0).toLocaleString()}
              {detail.manufacturingDate ? ` · mfg ${detail.manufacturingDate}` : ""}
              {detail.supplierName ? ` · ${detail.supplierName}` : ""}
              {detail.createdByName ? ` · received by ${detail.createdByName}` : ""}
            </p>
            {detail.notes && <p className="text-sm text-slate-600">{detail.notes}</p>}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase text-slate-400">Ledger</p>
              {movements.length === 0 ? (
                <p className="text-sm text-slate-400">No movements on this lot.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {movements.map((m) => (
                    <li key={m.id} className="rounded-xl bg-[#f3f7f7] px-3 py-2">
                      <span className="font-medium text-slate-700">{m.movementType}</span>
                      <span className="text-slate-500">
                        {" "}
                        {m.quantityChange} · {new Date(m.createdAt).toLocaleString()}
                      </span>
                      {m.notes ? <span className="block text-xs text-slate-400">{m.notes}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
