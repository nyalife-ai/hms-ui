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
import { useAuth } from "@/lib/auth";
import { buildListQuery, toPageMeta, unwrapPage } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type ServiceRow = {
  id: string;
  serviceCode: string;
  serviceName: string;
  category: string | null;
  description: string | null;
  standardPrice: string;
  revenueAccountId: string | null;
  isActive: boolean;
};

function formatKes(v: string | number) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v);
}

const emptyForm = {
  serviceCode: "",
  serviceName: "",
  category: "",
  description: "",
  standardPrice: "",
  isActive: true,
};

export default function BillingServicesPage() {
  const { user } = useAuth();
  const canEdit =
    user?.role === "ACCOUNTANT" ||
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN";
  const canSetTriageFee =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [triageFeeCode, setTriageFeeCode] = useState<string | null>(null);

  const loadFees = useCallback(async () => {
    try {
      const fees = await api<{
        consult: number;
        consultServiceCode?: string;
        consultServiceName?: string;
      }>("/billing/fees");
      setTriageFeeCode(fees.consultServiceCode || null);
    } catch {
      /* optional */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildListQuery({
        page,
        limit: 50,
        search: search || undefined,
      });
      const res = unwrapPage<ServiceRow>(await api(`/billing/services?${qs}`));
      setRows(res.items);
      setTotal(res.total);
      setLimit(res.limit);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load services");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadFees();
  }, [loadFees]);

  const setAsTriageFee = async (row: ServiceRow) => {
    if (!canSetTriageFee) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/ops/settings", {
        method: "PUT",
        body: JSON.stringify({
          items: [
            {
              key: "consultation_fee_service_code",
              value: row.serviceCode,
              label: "Triage Consultation Fee Service",
              groupName: "general",
            },
          ],
        }),
      });
      setTriageFeeCode(row.serviceCode);
      setNotice(
        `Triage consultation fee is now ${row.serviceCode} — ${row.serviceName} (KES ${formatKes(row.standardPrice)}). New visits will charge this amount.`,
      );
      await loadFees();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set triage fee");
    } finally {
      setBusy(false);
    }
  };

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
      category: row.category ?? "",
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
    const price = Number(form.standardPrice);
    if (!Number.isFinite(price) || price < 0) {
      setFormError("Enter a valid price.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      if (editing) {
        await api(`/billing/services/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            serviceName: form.serviceName.trim(),
            category: form.category.trim() || null,
            description: form.description.trim() || null,
            standardPrice: price,
            isActive: form.isActive,
          }),
        });
      } else {
        await api("/billing/services", {
          method: "POST",
          body: JSON.stringify({
            serviceCode: form.serviceCode.trim(),
            serviceName: form.serviceName.trim(),
            category: form.category.trim() || undefined,
            description: form.description.trim() || undefined,
            standardPrice: price,
            isActive: form.isActive,
          }),
        });
      }
      setOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save service");
    } finally {
      setBusy(false);
    }
  };

  const meta = toPageMeta({ total, page, limit });

  return (
    <RoleGuard module="billing-ledger">
      <PageHeader
        title="Services"
        subtitle={loading ? "Loading…" : `${total.toLocaleString()} billable services`}
        action={
          canEdit ? (
            <PrimaryButton onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add service
            </PrimaryButton>
          ) : undefined
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      {notice && <p className="mb-4 text-sm text-emerald-600">{notice}</p>}
      {triageFeeCode && (
        <p className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
          Triage consultation fee currently uses service code{" "}
          <span className="font-semibold">{triageFeeCode}</span>. New consult-fee
          invoices use this price from the fee schedule.
        </p>
      )}
      <div className="mb-4">
        <input
          className={inputClass}
          placeholder="Search services…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <Card>
        <CardHeader title="Fee schedule / services" subtitle={`${total.toLocaleString()} records`} />
        <Table
          headers={[
            "Code",
            "Name",
            "Category",
            "Price",
            "Status",
            ...(canEdit ? [""] : []),
          ]}
        >
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 font-semibold text-slate-800">{s.serviceCode}</td>
              <td className="px-5 py-3.5 text-slate-700">
                {s.serviceName}
                {s.description && (
                  <span className="block text-xs text-slate-400">{s.description}</span>
                )}
                {triageFeeCode === s.serviceCode && (
                  <span className="mt-1 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                    Triage consult fee
                  </span>
                )}
              </td>
              <td className="px-5 py-3.5 text-slate-500">{s.category || "—"}</td>
              <td className="px-5 py-3.5 text-slate-600">{formatKes(s.standardPrice)}</td>
              <td className="px-5 py-3.5">
                <Badge tone={s.isActive ? "green" : "slate"}>
                  {s.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
              {canEdit && (
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <TableAction
                      icon={Pencil}
                      label="Edit service"
                      tone="edit"
                      onClick={() => openEdit(s)}
                    />
                    {canSetTriageFee &&
                      s.isActive &&
                      triageFeeCode !== s.serviceCode &&
                      ((s.category || "").toLowerCase().includes("consult") ||
                        s.serviceCode === "CONSULT") && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void setAsTriageFee(s)}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
                        >
                          Use for triage
                        </button>
                      )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </Table>
        {rows.length === 0 && !loading && (
          <p className="px-5 pb-5 text-sm text-slate-400">No services found.</p>
        )}
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                {editing ? "Edit service" : "Add service"}
              </h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            {!editing && (
              <div>
                <FieldLabel required>Code</FieldLabel>
                <input
                  className={inputClass}
                  value={form.serviceCode}
                  onChange={(e) => setForm((f) => ({ ...f, serviceCode: e.target.value }))}
                />
              </div>
            )}
            <div>
              <FieldLabel required>Name</FieldLabel>
              <input
                className={inputClass}
                value={form.serviceName}
                onChange={(e) => setForm((f) => ({ ...f, serviceName: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel optional>Category</FieldLabel>
              <input
                className={inputClass}
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
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
            <div>
              <FieldLabel required>Standard price</FieldLabel>
              <input
                className={inputClass}
                type="number"
                min={0}
                step="0.01"
                value={form.standardPrice}
                onChange={(e) => setForm((f) => ({ ...f, standardPrice: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Active
            </label>
            {formError && <p className="text-[11px] font-medium text-rose-500">{formError}</p>}
            <PrimaryButton disabled={busy} onClick={save}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
