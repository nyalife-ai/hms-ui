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

type Param = {
  id: string;
  parameterName: string;
  unitOfMeasurement: string | null;
  normalReferenceRange: string | null;
  displayOrder: number;
  isActive: boolean;
};

type TestType = {
  id: string;
  testName: string;
  category: string | null;
  standardPrice: number;
  isActive: boolean;
  parameterCount: number;
  parameters?: Param[];
};

export default function LabTestTypesPage() {
  const [rows, setRows] = useState<TestType[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [paramOpen, setParamOpen] = useState<TestType | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Haematology");
  const [price, setPrice] = useState("0");
  const [paramName, setParamName] = useState("");
  const [unit, setUnit] = useState("");
  const [range, setRange] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api<{ items: TestType[] }>(
        `/laboratory/test-types?active=true${search ? `&search=${encodeURIComponent(search)}` : ""}`,
      );
      setRows(data.items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api("/laboratory/test-types", {
        method: "POST",
        body: JSON.stringify({
          testName: name.trim(),
          category,
          standardPrice: Number(price) || 0,
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

  const addParam = async () => {
    if (!paramOpen || !paramName.trim()) return;
    setBusy(true);
    try {
      await api("/laboratory/parameters", {
        method: "POST",
        body: JSON.stringify({
          testTypeId: paramOpen.id,
          parameterName: paramName.trim(),
          unitOfMeasurement: unit || undefined,
          normalReferenceRange: range || undefined,
          displayOrder: (paramOpen.parameters?.length ?? 0) + 1,
        }),
      });
      setParamName("");
      setUnit("");
      setRange("");
      const detail = await api<TestType>(`/laboratory/test-types/${paramOpen.id}`);
      setParamOpen(detail);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parameter failed");
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (id: string) => {
    try {
      setParamOpen(await api<TestType>(`/laboratory/test-types/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load detail");
    }
  };

  return (
    <RoleGuard module="laboratory">
      <PageHeader
        title="Test Types"
        subtitle="Panels and their parameters"
        action={
          <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add test type
          </PrimaryButton>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <div className="mb-4">
        <input
          className={inputClass}
          placeholder="Search test types…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Card>
        <CardHeader title="Active formulary" subtitle={`${rows.length} types`} />
        <Table headers={["Test", "Category", "Price", "Parameters", "Status", ""]}>
          {rows.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 font-medium text-slate-800">{t.testName}</td>
              <td className="px-5 py-3.5 text-slate-500">{t.category || "—"}</td>
              <td className="px-5 py-3.5 text-slate-500">{t.standardPrice}</td>
              <td className="px-5 py-3.5 text-slate-500">{t.parameterCount}</td>
              <td className="px-5 py-3.5">
                <Badge tone={t.isActive ? "green" : "slate"}>
                  {t.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="px-5 py-3.5">
                <button
                  type="button"
                  className="rounded-full border px-3 py-1 text-xs"
                  onClick={() => void openDetail(t.id)}
                >
                  Parameters
                </button>
              </td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 && (
          <p className="px-5 pb-5 text-sm text-slate-400">No test types yet.</p>
        )}
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex justify-between">
              <h2 className="font-semibold">Add test type</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <input className={inputClass} placeholder="Test name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={inputClass} placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
            <input className={inputClass} type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
            <PrimaryButton disabled={busy} onClick={create}>
              {busy ? "Saving…" : "Create"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {paramOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex justify-between">
              <div>
                <h2 className="font-semibold">{paramOpen.testName}</h2>
                <p className="text-xs text-slate-400">Parameters</p>
              </div>
              <button type="button" onClick={() => setParamOpen(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
              {(paramOpen.parameters ?? []).map((p) => (
                <li key={p.id} className="rounded-xl bg-slate-50 px-3 py-2">
                  <span className="font-medium">{p.parameterName}</span>
                  <span className="text-slate-400">
                    {" "}
                    · {p.unitOfMeasurement || "—"} · {p.normalReferenceRange || "—"}
                  </span>
                </li>
              ))}
              {(paramOpen.parameters ?? []).length === 0 && (
                <li className="text-slate-400">No parameters yet.</li>
              )}
            </ul>
            <input className={inputClass} placeholder="Parameter name" value={paramName} onChange={(e) => setParamName(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className={inputClass} placeholder="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
              <input className={inputClass} placeholder="Reference range" value={range} onChange={(e) => setRange(e.target.value)} />
            </div>
            <PrimaryButton disabled={busy} onClick={addParam}>
              {busy ? "Saving…" : "Add parameter"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
