"use client";

import { Pencil, Plus, Power, PowerOff, X } from "lucide-react";
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
import { buildListQuery, toPageMeta, unwrapPage } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type Supplier = {
  id: string;
  companyName: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
};

const emptyForm = {
  companyName: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
};

export default function PharmacySuppliersPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildListQuery({ page, limit: 20, search: search || undefined });
      const data = await api<unknown>(`/pharmacy/suppliers?${qs}`);
      const pageData = unwrapPage<Supplier>(data);
      setRows(pageData.items);
      setTotal(pageData.total);
      setLimit(pageData.limit);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = async (row: Supplier) => {
    try {
      const s = await api<Supplier>(`/pharmacy/suppliers/${row.id}`);
      setEditing(s);
      setForm({
        companyName: s.companyName,
        contactPerson: s.contactPerson ?? "",
        phone: s.phone ?? "",
        email: s.email ?? "",
        address: s.address ?? "",
      });
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load supplier");
    }
  };

  const save = async () => {
    if (!form.companyName.trim()) {
      setError("Company name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = {
        companyName: form.companyName.trim(),
        contactPerson: form.contactPerson.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
      };
      if (editing) {
        await api(`/pharmacy/suppliers/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await api("/pharmacy/suppliers", {
          method: "POST",
          body: JSON.stringify(body),
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

  const toggleActive = async (row: Supplier) => {
    const path = row.isActive ? "deactivate" : "activate";
    try {
      await api(`/pharmacy/suppliers/${row.id}/${path}`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status change failed");
    }
  };

  return (
    <RoleGuard module="pharmacy">
      <PageHeader
        title="Suppliers"
        subtitle={loading ? "Loading…" : `${total} vendors`}
        action={
          <PrimaryButton onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add supplier
          </PrimaryButton>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <div className="mb-4">
        <input
          className={`${inputClass} max-w-md`}
          placeholder="Search company…"
          value={searchInput}
          onChange={(e) => {
            setPage(1);
            setSearchInput(e.target.value);
          }}
        />
      </div>
      <Card>
        <CardHeader title="Vendor registry" subtitle="Used on purchase orders and inbound lots" />
        <Table headers={["Company", "Contact", "Phone", "Email", "Status", ""]}>
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5">
                <p className="font-medium text-slate-800">{s.companyName}</p>
                <p className="text-[11px] text-slate-400">{s.address || "—"}</p>
              </td>
              <td className="px-5 py-3.5 text-slate-500">{s.contactPerson || "—"}</td>
              <td className="px-5 py-3.5 text-slate-500">{s.phone || "—"}</td>
              <td className="px-5 py-3.5 text-slate-500">{s.email || "—"}</td>
              <td className="px-5 py-3.5">
                <Badge tone={s.isActive ? "green" : "slate"}>
                  {s.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="px-5 py-3.5">
                <div className="flex justify-end gap-0.5">
                  <TableAction icon={Pencil} label="Edit" tone="edit" onClick={() => void openEdit(s)} />
                  <TableAction
                    icon={s.isActive ? PowerOff : Power}
                    label={s.isActive ? "Deactivate" : "Activate"}
                    tone={s.isActive ? "danger" : "add"}
                    onClick={() => void toggleActive(s)}
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
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                {editing ? "Edit supplier" : "Add supplier"}
              </h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div>
              <FieldLabel required>Company name</FieldLabel>
              <input
                className={inputClass}
                value={form.companyName}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel optional>Contact person</FieldLabel>
              <input
                className={inputClass}
                value={form.contactPerson}
                onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel optional>Phone</FieldLabel>
                <input
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel optional>Email</FieldLabel>
                <input
                  className={inputClass}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <FieldLabel optional>Address</FieldLabel>
              <input
                className={inputClass}
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <PrimaryButton disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
