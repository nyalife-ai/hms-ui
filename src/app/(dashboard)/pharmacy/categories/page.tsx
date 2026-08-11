"use client";

import { Pencil, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FieldLabel } from "@/components/field-label";
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

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type Category = {
  id: string;
  categoryName: string;
  description: string | null;
  isActive: boolean;
};

const emptyForm = { categoryName: "", description: "", isActive: true };

export default function PharmacyCategoriesPage() {
  const [rows, setRows] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Category[]>("/pharmacy/categories");
      setRows(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = async (row: Category) => {
    try {
      const detail = await api<Category>(`/pharmacy/categories/${row.id}`);
      setEditing(detail);
      setForm({
        categoryName: detail.categoryName,
        description: detail.description ?? "",
        isActive: detail.isActive,
      });
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load category");
    }
  };

  const save = async () => {
    if (!form.categoryName.trim()) {
      setError("Category name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (editing) {
        await api(`/pharmacy/categories/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            categoryName: form.categoryName.trim(),
            description: form.description.trim() || undefined,
            isActive: form.isActive,
          }),
        });
      } else {
        await api("/pharmacy/categories", {
          method: "POST",
          body: JSON.stringify({
            categoryName: form.categoryName.trim(),
            description: form.description.trim() || undefined,
          }),
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

  return (
    <RoleGuard module="pharmacy">
      <PageHeader
        title="Medication categories"
        subtitle={loading ? "Loading…" : `${rows.length} categories`}
        action={
          <PrimaryButton onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add category
          </PrimaryButton>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <Card>
        <CardHeader title="Formulary groups" subtitle="Used when adding medications" />
        <Table headers={["Name", "Description", "Status", ""]}>
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 font-medium text-slate-800">{c.categoryName}</td>
              <td className="px-5 py-3.5 text-slate-500">{c.description || "—"}</td>
              <td className="px-5 py-3.5">
                <Badge tone={c.isActive ? "green" : "slate"}>
                  {c.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="px-5 py-3.5">
                <TableAction icon={Pencil} label="Edit category" tone="edit" onClick={() => void openEdit(c)} />
              </td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 && !loading && (
          <p className="px-5 pb-5 text-sm text-slate-400">No categories yet.</p>
        )}
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                {editing ? "Edit category" : "Add category"}
              </h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div>
              <FieldLabel required>Name</FieldLabel>
              <input
                className={inputClass}
                value={form.categoryName}
                onChange={(e) => setForm((f) => ({ ...f, categoryName: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel optional>Description</FieldLabel>
              <input
                className={inputClass}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            {editing && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                Active
              </label>
            )}
            <PrimaryButton disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
