"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
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

type Med = {
  id: string;
  medicationName: string;
  genericName: string | null;
  categoryName: string | null;
  form: string | null;
  unit: string | null;
  standardSellingPrice: number;
  quantityOnHand: number;
  isActive: boolean;
};

type Category = { id: string; categoryName: string };

const FORMS = ["TABLET", "CAPSULE", "SYRUP", "INJECTION", "CREAM", "OTHER"];

export default function PharmacyMedicationsPage() {
  const [rows, setRows] = useState<Med[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [form, setForm] = useState("TABLET");
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState("tabs");
  const [price, setPrice] = useState("0");

  const load = useCallback(async () => {
    try {
      const [m, c] = await Promise.all([
        api<Med[]>("/pharmacy/medications"),
        api<Category[]>("/pharmacy/categories"),
      ]);
      setRows(m);
      setCategories(c);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api("/pharmacy/medications", {
        method: "POST",
        body: JSON.stringify({
          medicationName: name.trim(),
          form,
          categoryId: categoryId || undefined,
          unit,
          standardSellingPrice: Number(price) || 0,
        }),
      });
      setOpen(false);
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <RoleGuard module="pharmacy">
      <PageHeader
        title="Medications"
        subtitle="Formulary from /pharmacy/medications"
        action={
          <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add medication
          </PrimaryButton>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <Card>
        <CardHeader title="Active formulary" subtitle={`${rows.length} medications`} />
        <Table headers={["Name", "Form", "Category", "Stock", "Price", "Status"]}>
          {rows.map((m) => (
            <tr key={m.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 font-medium text-slate-800">
                {m.medicationName}
                {m.genericName && (
                  <span className="block text-xs text-slate-400">{m.genericName}</span>
                )}
              </td>
              <td className="px-5 py-3.5 text-slate-500">{m.form || "—"}</td>
              <td className="px-5 py-3.5 text-slate-500">{m.categoryName || "—"}</td>
              <td className="px-5 py-3.5 text-slate-500">
                {m.quantityOnHand} {m.unit || ""}
              </td>
              <td className="px-5 py-3.5 text-slate-500">{m.standardSellingPrice}</td>
              <td className="px-5 py-3.5">
                <Badge tone={m.isActive ? "green" : "slate"}>
                  {m.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Add medication</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <input className={inputClass} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <select className={inputClass} value={form} onChange={(e) => setForm(e.target.value)}>
              {FORMS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Category (optional)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.categoryName}</option>
              ))}
            </select>
            <input className={inputClass} placeholder="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
            <input className={inputClass} type="number" min={0} placeholder="Selling price" value={price} onChange={(e) => setPrice(e.target.value)} />
            <PrimaryButton disabled={busy} onClick={create}>
              {busy ? "Saving…" : "Create"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
