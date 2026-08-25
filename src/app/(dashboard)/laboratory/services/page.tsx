"use client";

import { Pencil, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import {
  CLINICAL_SERVICE_CATEGORIES,
  type ClinicalServiceKind,
} from "@/lib/clinical-service";
import { buildListQuery, toPageMeta, unwrapPage } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type ServiceRow = {
  id: string;
  serviceCode: string;
  serviceName: string;
  category: string | null;
  description: string | null;
  standardPrice: string;
  isActive: boolean;
  kind: ClinicalServiceKind;
};

const emptyForm = {
  serviceCode: "",
  serviceName: "",
  category: "Procedures",
  description: "",
  standardPrice: "0",
  isActive: true,
};

const PAGE_SIZE = 50;

export default function LaboratoryServicesPage() {
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const [kindFilter, setKindFilter] = useState<"" | ClinicalServiceKind>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildListQuery({
        search: search || undefined,
        kind: kindFilter || undefined,
        active: true,
        page,
        limit: PAGE_SIZE,
      });
      const data = unwrapPage<ServiceRow>(
        await api(`/laboratory/clinical-services?${qs}`),
      );
      setRows(data.items);
      setTotal(data.total);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load services");
    } finally {
      setLoading(false);
    }
  }, [search, kindFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setOpen(true);
  };

  const openEdit = (row: ServiceRow) => {
    setEditing(row);
    setForm({
      serviceCode: row.serviceCode,
      serviceName: row.serviceName,
      category: row.category ?? "Procedures",
      description: row.description ?? "",
      standardPrice: row.standardPrice,
      isActive: row.isActive,
    });
    setFormError("");
    setOpen(true);
  };

  const save = async () => {
    if (!editing && !form.serviceCode.trim()) {
      setFormError("Service code is required.");
      return;
    }
    if (!form.serviceName.trim()) {
      setFormError("Service name is required.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      if (editing) {
        await api(`/laboratory/clinical-services/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            serviceName: form.serviceName.trim(),
            category: form.category || null,
            description: form.description.trim() || null,
            standardPrice: form.standardPrice,
            isActive: form.isActive,
          }),
        });
      } else {
        await api("/laboratory/clinical-services", {
          method: "POST",
          body: JSON.stringify({
            serviceCode: form.serviceCode.trim(),
            serviceName: form.serviceName.trim(),
            category: form.category || undefined,
            description: form.description.trim() || undefined,
            standardPrice: form.standardPrice,
            isActive: form.isActive,
          }),
        });
      }
      setOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <RoleGuard module="laboratory">
      <PageHeader
        title="Services & Procedures"
        subtitle="Vaccines, procedures, and surgeries doctors can order during consultation"
        action={
          <PrimaryButton onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add service
          </PrimaryButton>
        }
      />

      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      <Card>
        <CardHeader
          title="Clinical order catalog"
          subtitle="Use category Surgery for the surgeries picker; other categories appear under Services & Procedures"
        />
        <div className="flex flex-wrap gap-3 px-5 pb-4">
          <input
            className={`${inputClass} max-w-xs`}
            placeholder="Search code, name, category…"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
          />
          <select
            className={`${inputClass} max-w-[200px]`}
            value={kindFilter}
            onChange={(e) => {
              setKindFilter(e.target.value as "" | ClinicalServiceKind);
              setPage(1);
            }}
          >
            <option value="">All kinds</option>
            <option value="service">Services & procedures</option>
            <option value="surgery">Surgeries</option>
          </select>
        </div>
        <Table headers={["Code", "Name", "Category", "Kind", "Price (KES)", ""]}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-surface-200/60">
              <td className="px-5 py-3.5 font-semibold text-foreground">
                {r.serviceCode}
              </td>
              <td className="px-5 py-3.5 text-foreground">{r.serviceName}</td>
              <td className="px-5 py-3.5 text-foreground-light">
                {r.category ?? "—"}
              </td>
              <td className="px-5 py-3.5">
                <Badge tone={r.kind === "surgery" ? "amber" : "teal"}>
                  {r.kind === "surgery" ? "Surgery" : "Service"}
                </Badge>
              </td>
              <td className="px-5 py-3.5 text-foreground-light">
                {Number(r.standardPrice).toLocaleString()}
              </td>
              <td className="px-5 py-3.5">
                <TableAction
                  icon={Pencil}
                  label="Edit service"
                  tone="edit"
                  onClick={() => openEdit(r)}
                />
              </td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 && !loading && (
          <p className="px-5 pb-5 text-sm text-foreground-lighter">
            No clinical services yet. Add vaccines, procedures, or surgeries.
          </p>
        )}
        <PaginationBar
          meta={toPageMeta({ total, page, limit: PAGE_SIZE })}
          onPageChange={setPage}
          disabled={loading}
        />
      </Card>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">
                {editing ? "Edit service" : "Add service / procedure / surgery"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-foreground-lighter hover:bg-surface-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              {!editing && (
                <div>
                  <FieldLabel>Service code</FieldLabel>
                  <input
                    className={inputClass}
                    value={form.serviceCode}
                    onChange={(e) =>
                      setForm({ ...form, serviceCode: e.target.value })
                    }
                    placeholder="e.g. PROC-CSECTION"
                  />
                </div>
              )}
              <div>
                <FieldLabel>Name</FieldLabel>
                <input
                  className={inputClass}
                  value={form.serviceName}
                  onChange={(e) =>
                    setForm({ ...form, serviceName: e.target.value })
                  }
                  placeholder="e.g. Caesarean Delivery — Surgeon fee"
                />
              </div>
              <div>
                <FieldLabel>Category</FieldLabel>
                <select
                  className={inputClass}
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                >
                  {CLINICAL_SERVICE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-foreground-lighter">
                  Choose <strong>Surgery</strong> for the doctor surgeries
                  picker.
                </p>
              </div>
              <div>
                <FieldLabel>Standard price (KES)</FieldLabel>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={form.standardPrice}
                  onChange={(e) =>
                    setForm({ ...form, standardPrice: e.target.value })
                  }
                />
              </div>
              <div>
                <FieldLabel>Description (optional)</FieldLabel>
                <textarea
                  className={`${inputClass} min-h-20 resize-y`}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              {formError && (
                <p className="text-xs text-rose-500">{formError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground-light"
                >
                  Cancel
                </button>
                <PrimaryButton onClick={() => void save()} disabled={busy}>
                  {busy ? "Saving…" : "Save"}
                </PrimaryButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
