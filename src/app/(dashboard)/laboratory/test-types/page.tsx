"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BulkImportButton } from "@/components/bulk-import-button";
import { FieldLabel } from "@/components/field-label";
import { PaginationBar } from "@/components/pagination-bar";
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
import { buildListQuery, toPageMeta, unwrapPage } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

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

const PAGE_SIZE = 50;

export default function LabTestTypesPage() {
  const [rows, setRows] = useState<TestType[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [paramOpen, setParamOpen] = useState<TestType | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Haematology");
  const [price, setPrice] = useState("0");
  const [paramName, setParamName] = useState("");
  const [unit, setUnit] = useState("");
  const [range, setRange] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildListQuery({
        search: search || undefined,
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      });
      const data = unwrapPage<TestType>(await api(`/laboratory/test-types?${qs}`));
      setRows(data.items);
      setTotal(data.total);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [search, page]);

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

  const meta = toPageMeta({ total, page, limit: PAGE_SIZE });

  return (
    <RoleGuard module="laboratory">
      <PageHeader
        title="Test Types"
        subtitle={loading ? "Loading…" : `${total.toLocaleString()} panels and parameters`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <BulkImportButton
              resource="lab-test-types"
              title="Import lab test types"
              description="First row is the header. Fix all errors before import — partial import is not allowed."
              label="Import test types"
              onImported={load}
            />
            <PrimaryButton onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Add test type
            </PrimaryButton>
          </div>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <div className="mb-4">
        <input
          className={inputClass}
          placeholder="Search test types…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <Card>
        <CardHeader title="Active formulary" subtitle={`${total.toLocaleString()} types`} />
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
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="rounded-full border px-3 py-1 text-xs"
                    onClick={() => void openDetail(t.id)}
                  >
                    Parameters
                  </button>
                  <button
                    type="button"
                    className="rounded-full border px-3 py-1 text-xs"
                    onClick={() =>
                      void api(
                        `/laboratory/test-types/${t.id}/${t.isActive ? "deactivate" : "activate"}`,
                        { method: "POST" },
                      ).then(() => load())
                    }
                  >
                    {t.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
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
            <div>
              <FieldLabel required>Test name</FieldLabel>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <FieldLabel optional>Category</FieldLabel>
              <input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div>
              <FieldLabel optional>Price</FieldLabel>
              <input className={inputClass} type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
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
            <div>
              <FieldLabel required>Parameter name</FieldLabel>
              <input className={inputClass} value={paramName} onChange={(e) => setParamName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <FieldLabel optional>Unit</FieldLabel>
                <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} />
              </div>
              <div>
                <FieldLabel optional>Reference range</FieldLabel>
                <input className={inputClass} value={range} onChange={(e) => setRange(e.target.value)} />
              </div>
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
