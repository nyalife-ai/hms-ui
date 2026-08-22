"use client";

import { Eye, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BulkImportButton } from "@/components/bulk-import-button";
import { FieldLabel } from "@/components/field-label";
import { PaginationBar } from "@/components/pagination-bar";
import { RoleGuard } from "@/components/role-guard";
import { TableAction } from "@/components/table-action";
import {
  Badge,
  Card,
  CardHeader,
  PageHeader,
  PrimaryButton,
  Table,
} from "@/components/ui";
import { api } from "@/lib/api";
import { buildListQuery, toPageMeta, unwrapPage } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

const FORMS = ["TABLET", "CAPSULE", "SYRUP", "INJECTION", "CREAM", "OTHER"] as const;

type Category = { id: string; categoryName: string; isActive: boolean };
type Batch = {
  id: string;
  batchNumber: string;
  quantityOnHand: number;
  expiryDate: string;
  expired: boolean;
  supplierName: string | null;
};
type Med = {
  id: string;
  medicationName: string;
  genericName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  form: string | null;
  strength: string | null;
  unit: string | null;
  standardSellingPrice: number;
  description: string | null;
  sideEffects: string | null;
  contraindications: string | null;
  isActive: boolean;
  quantityOnHand?: number;
  batchCount?: number;
  batches?: Batch[];
};

const emptyForm = {
  medicationName: "",
  genericName: "",
  categoryId: "",
  form: "TABLET",
  strength: "",
  unit: "",
  standardSellingPrice: "",
  description: "",
  sideEffects: "",
  contraindications: "",
  isActive: true,
};

export default function PharmacyMedicationsPage() {
  const [rows, setRows] = useState<Med[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const [categoryId, setCategoryId] = useState("");
  const [formFilter, setFormFilter] = useState("");
  const [cats, setCats] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Med | null>(null);
  const [detail, setDetail] = useState<Med | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildListQuery({
        page,
        limit: 20,
        search: search || undefined,
        categoryId: categoryId || undefined,
        form: formFilter || undefined,
      });
      const [medRes, catRes] = await Promise.all([
        api<unknown>(`/pharmacy/medications?${qs}`),
        api<Category[]>("/pharmacy/categories"),
      ]);
      const pageData = unwrapPage<Med>(medRes);
      setRows(pageData.items);
      setTotal(pageData.total);
      setLimit(pageData.limit);
      setCats(Array.isArray(catRes) ? catRes : []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load medications");
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryId, formFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = async (row: Med) => {
    try {
      const m = await api<Med>(`/pharmacy/medications/${row.id}`);
      setEditing(m);
      setForm({
        medicationName: m.medicationName,
        genericName: m.genericName ?? "",
        categoryId: m.categoryId ?? "",
        form: m.form || "TABLET",
        strength: m.strength ?? "",
        unit: m.unit ?? "",
        standardSellingPrice: String(m.standardSellingPrice ?? ""),
        description: m.description ?? "",
        sideEffects: m.sideEffects ?? "",
        contraindications: m.contraindications ?? "",
        isActive: m.isActive,
      });
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load medication");
    }
  };

  const openDetail = async (row: Med) => {
    try {
      setDetail(await api<Med>(`/pharmacy/medications/${row.id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load medication");
    }
  };

  const payload = () => ({
    medicationName: form.medicationName.trim(),
    genericName: form.genericName.trim() || undefined,
    categoryId: form.categoryId || undefined,
    form: form.form,
    strength: form.strength.trim() || undefined,
    unit: form.unit.trim() || undefined,
    standardSellingPrice: form.standardSellingPrice
      ? Number(form.standardSellingPrice)
      : undefined,
    description: form.description.trim() || undefined,
    sideEffects: form.sideEffects.trim() || undefined,
    contraindications: form.contraindications.trim() || undefined,
    ...(editing ? { isActive: form.isActive } : {}),
  });

  const save = async () => {
    if (!form.medicationName.trim()) {
      setError("Medication name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (editing) {
        await api(`/pharmacy/medications/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload()),
        });
      } else {
        await api("/pharmacy/medications", {
          method: "POST",
          body: JSON.stringify(payload()),
        });
      }
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: Med) => {
    if (!confirm(`Soft-delete ${row.medicationName}? It will leave the formulary.`)) return;
    try {
      await api(`/pharmacy/medications/${row.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <RoleGuard module="pharmacy">
      <PageHeader
        title="Medications"
        subtitle={loading ? "Loading…" : `${total} in formulary`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <BulkImportButton
              resource="medications"
              title="Import medications"
              description="First row is the header. Category names must already exist. Partial import of invalid CSVs is not allowed."
              label="Import medications"
              onImported={load}
            />
            <PrimaryButton onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add medication
            </PrimaryButton>
          </div>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className={`${inputClass} max-w-md`}
          placeholder="Search name or generic…"
          value={searchInput}
          onChange={(e) => {
            setPage(1);
            setSearchInput(e.target.value);
          }}
        />
        <select
          className={`${inputClass} max-w-[200px]`}
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.categoryName}
            </option>
          ))}
        </select>
        <select
          className={`${inputClass} max-w-[160px]`}
          value={formFilter}
          onChange={(e) => {
            setFormFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All forms</option>
          {FORMS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <Card>
        <CardHeader title="Formulary" subtitle="Price, stock roll-up, clinical notes" />
        <Table headers={["Name", "Generic", "Form", "Price", "On hand", "Status", ""]}>
          {rows.map((m) => (
            <tr key={m.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5">
                <p className="font-medium text-slate-800">{m.medicationName}</p>
                <p className="text-[11px] text-slate-400">
                  {m.categoryName || "Uncategorised"}
                  {m.strength ? ` · ${m.strength}` : ""}
                </p>
              </td>
              <td className="px-5 py-3.5 text-slate-500">{m.genericName || "—"}</td>
              <td className="px-5 py-3.5 text-slate-500">{m.form || "—"}</td>
              <td className="px-5 py-3.5 text-slate-600">
                KES {Number(m.standardSellingPrice || 0).toLocaleString()}
              </td>
              <td className="px-5 py-3.5 text-slate-600">{m.quantityOnHand ?? 0}</td>
              <td className="px-5 py-3.5">
                <Badge tone={m.isActive ? "green" : "slate"}>
                  {m.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="px-5 py-3.5">
                <div className="flex justify-end gap-0.5">
                  <TableAction icon={Eye} label="View" onClick={() => void openDetail(m)} />
                  <TableAction icon={Pencil} label="Edit" tone="edit" onClick={() => void openEdit(m)} />
                  <TableAction
                    icon={Trash2}
                    label="Delete"
                    tone="danger"
                    onClick={() => void remove(m)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <PaginationBar
          meta={toPageMeta({ total, page, limit })}
          onPageChange={setPage}
          disabled={loading}
        />
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                {editing ? "Edit medication" : "Add medication"}
              </h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div>
              <FieldLabel required>Name</FieldLabel>
              <input
                className={inputClass}
                value={form.medicationName}
                onChange={(e) => setForm((f) => ({ ...f, medicationName: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel optional>Generic name</FieldLabel>
              <input
                className={inputClass}
                value={form.genericName}
                onChange={(e) => setForm((f) => ({ ...f, genericName: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel optional>Category</FieldLabel>
                <select
                  className={inputClass}
                  value={form.categoryId}
                  onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                >
                  <option value="">None</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.categoryName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel optional>Form</FieldLabel>
                <select
                  className={inputClass}
                  value={form.form}
                  onChange={(e) => setForm((f) => ({ ...f, form: e.target.value }))}
                >
                  {FORMS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <FieldLabel optional>Strength</FieldLabel>
                <input
                  className={inputClass}
                  value={form.strength}
                  onChange={(e) => setForm((f) => ({ ...f, strength: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel optional>Unit</FieldLabel>
                <input
                  className={inputClass}
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel optional>Sell price</FieldLabel>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={form.standardSellingPrice}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, standardSellingPrice: e.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <FieldLabel optional>Description</FieldLabel>
              <textarea
                className={inputClass}
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel optional>Side effects</FieldLabel>
              <textarea
                className={inputClass}
                rows={2}
                value={form.sideEffects}
                onChange={(e) => setForm((f) => ({ ...f, sideEffects: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel optional>Contraindications</FieldLabel>
              <textarea
                className={inputClass}
                rows={2}
                value={form.contraindications}
                onChange={(e) => setForm((f) => ({ ...f, contraindications: e.target.value }))}
              />
            </div>
            {editing && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                Active in formulary
              </label>
            )}
            <PrimaryButton disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">{detail.medicationName}</h2>
              <button type="button" onClick={() => setDetail(null)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <p className="text-sm text-slate-500">
              {detail.genericName || "No generic"} · {detail.form || "—"} ·{" "}
              {detail.strength || "no strength"} · {detail.categoryName || "Uncategorised"}
            </p>
            <p className="text-sm text-slate-600">
              Sell price KES {Number(detail.standardSellingPrice || 0).toLocaleString()}
            </p>
            {detail.description && (
              <p className="text-sm text-slate-600">{detail.description}</p>
            )}
            {detail.sideEffects && (
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-400">Side effects</p>
                <p className="text-sm text-slate-600">{detail.sideEffects}</p>
              </div>
            )}
            {detail.contraindications && (
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-400">
                  Contraindications
                </p>
                <p className="text-sm text-slate-600">{detail.contraindications}</p>
              </div>
            )}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase text-slate-400">Batches</p>
              {(detail.batches ?? []).length === 0 ? (
                <p className="text-sm text-slate-400">No lots on this medication.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.batches!.map((b) => (
                    <li key={b.id} className="rounded-xl bg-[#f3f7f7] px-3 py-2 text-sm">
                      <span className="font-medium text-slate-800">{b.batchNumber}</span>
                      <span className="text-slate-500">
                        {" "}
                        · {b.quantityOnHand} on hand · exp {b.expiryDate}
                        {b.expired ? " · expired" : ""}
                      </span>
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
