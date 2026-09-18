"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FieldLabel } from "@/components/field-label";
import { RoleGuard } from "@/components/role-guard";
import { Badge, Card, PageHeader, PrimaryButton, Table } from "@/components/ui";
import { api } from "@/lib/api";
import { useDepartments } from "@/lib/catalog";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type ScanType = {
  id: string;
  scanType: string;
  category: string | null;
  description: string | null;
  standardPrice: number;
  typicalDurationMinutes: number | null;
  contrastRequired: boolean;
  preparationInstructions: string | null;
  departmentId: string | null;
  departmentName: string | null;
  isActive: boolean;
};

const EMPTY_FORM = {
  scanType: "",
  category: "",
  description: "",
  standardPrice: "0",
  typicalDurationMinutes: "",
  contrastRequired: false,
  preparationInstructions: "",
  departmentId: "",
};

export default function RadiologyScanTypesPage() {
  const [rows, setRows] = useState<ScanType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { data: departments } = useDepartments();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api<ScanType[]>("/imaging/scan-types"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load scan types");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (row: ScanType) => {
    setEditingId(row.id);
    setForm({
      scanType: row.scanType,
      category: row.category ?? "",
      description: row.description ?? "",
      standardPrice: String(row.standardPrice),
      typicalDurationMinutes: row.typicalDurationMinutes ? String(row.typicalDurationMinutes) : "",
      contrastRequired: row.contrastRequired,
      preparationInstructions: row.preparationInstructions ?? "",
      departmentId: row.departmentId ?? "",
    });
    setFormError("");
    setShowModal(true);
  };

  const submit = async () => {
    if (!form.scanType.trim()) {
      setFormError("Scan type name is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    const body = {
      scanType: form.scanType.trim(),
      category: form.category.trim() || undefined,
      description: form.description.trim() || undefined,
      standardPrice: Number(form.standardPrice) || 0,
      typicalDurationMinutes: form.typicalDurationMinutes ? Number(form.typicalDurationMinutes) : undefined,
      contrastRequired: form.contrastRequired,
      preparationInstructions: form.preparationInstructions.trim() || undefined,
      departmentId: form.departmentId || undefined,
    };
    try {
      if (editingId) {
        await api(`/imaging/scan-types/${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/imaging/scan-types", { method: "POST", body: JSON.stringify(body) });
      }
      setShowModal(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save scan type");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard module="radiology">
      <PageHeader
        title="Scan types"
        subtitle={loading ? "Loading scan types…" : `${rows.length} configured scan types`}
        action={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" />
            New scan type
          </button>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      <Card>
        <Table headers={["Scan type", "Category", "Department", "Price", "Duration", "Contrast", "Status", ""]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 font-medium text-foreground">{r.scanType}</td>
              <td className="px-4 py-3 text-foreground-light">{r.category ?? "—"}</td>
              <td className="px-4 py-3 text-foreground-light">{r.departmentName ?? "—"}</td>
              <td className="px-4 py-3 text-foreground-light">{r.standardPrice.toLocaleString()}</td>
              <td className="px-4 py-3 text-foreground-light">
                {r.typicalDurationMinutes ? `${r.typicalDurationMinutes} min` : "—"}
              </td>
              <td className="px-4 py-3">
                {r.contrastRequired ? <Badge tone="amber">Required</Badge> : "—"}
              </td>
              <td className="px-4 py-3">
                <Badge tone={r.isActive ? "green" : "slate"}>{r.isActive ? "Active" : "Inactive"}</Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  className="text-xs font-medium text-brand-700 hover:underline"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-sm text-foreground-lighter">
                No scan types configured yet.
              </td>
            </tr>
          )}
        </Table>
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-lg space-y-3 rounded-2xl bg-surface p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">
                {editingId ? "Edit scan type" : "New scan type"}
              </h2>
              <button type="button" onClick={() => setShowModal(false)}>
                <X className="h-4 w-4 text-foreground-lighter" />
              </button>
            </div>
            <div>
              <FieldLabel required>Name</FieldLabel>
              <input
                className={inputClass}
                value={form.scanType}
                onChange={(e) => setForm({ ...form, scanType: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel optional>Category / modality</FieldLabel>
                <input
                  className={inputClass}
                  placeholder="e.g. Ultrasound"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel optional>Department</FieldLabel>
                <select
                  className={inputClass}
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                >
                  <option value="">—</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel optional>Standard price</FieldLabel>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.standardPrice}
                  onChange={(e) => setForm({ ...form, standardPrice: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel optional>Typical duration (min)</FieldLabel>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.typicalDurationMinutes}
                  onChange={(e) => setForm({ ...form, typicalDurationMinutes: e.target.value })}
                />
              </div>
            </div>
            <div>
              <FieldLabel optional>Description</FieldLabel>
              <textarea
                className={inputClass}
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel optional>Patient preparation instructions</FieldLabel>
              <textarea
                className={inputClass}
                rows={2}
                value={form.preparationInstructions}
                onChange={(e) => setForm({ ...form, preparationInstructions: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground-light">
              <input
                type="checkbox"
                checked={form.contrastRequired}
                onChange={(e) => setForm({ ...form, contrastRequired: e.target.checked })}
              />
              Contrast required
            </label>
            {formError && <p className="text-sm text-rose-600">{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground-light hover:border-brand-300"
              >
                Cancel
              </button>
              <PrimaryButton onClick={() => void submit()} disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Create scan type"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
