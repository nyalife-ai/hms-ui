"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import { Badge, Card, CardHeader, PageHeader, PrimaryButton, Table } from "@/components/ui";
import { api } from "@/lib/api";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type Supplier = {
  id: string;
  companyName: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
};

export default function PharmacySuppliersPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(await api<Supplier[]>("/pharmacy/suppliers"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!companyName.trim()) return;
    setBusy(true);
    try {
      await api("/pharmacy/suppliers", {
        method: "POST",
        body: JSON.stringify({
          companyName: companyName.trim(),
          phone: phone || undefined,
          email: email || undefined,
        }),
      });
      setOpen(false);
      setCompanyName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (id: string) => {
    try {
      await api(`/pharmacy/suppliers/${id}/deactivate`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deactivate failed");
    }
  };

  return (
    <RoleGuard module="pharmacy">
      <PageHeader
        title="Suppliers"
        subtitle="Vendor registry"
        action={
          <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add supplier
          </PrimaryButton>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <Card>
        <CardHeader title="Suppliers" subtitle={`${rows.length} records`} />
        <Table headers={["Company", "Contact", "Phone", "Email", "Status", "Actions"]}>
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 font-medium text-slate-800">{s.companyName}</td>
              <td className="px-5 py-3.5 text-slate-500">{s.contactPerson || "—"}</td>
              <td className="px-5 py-3.5 text-slate-500">{s.phone || "—"}</td>
              <td className="px-5 py-3.5 text-slate-500">{s.email || "—"}</td>
              <td className="px-5 py-3.5">
                <Badge tone={s.isActive ? "green" : "slate"}>
                  {s.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="px-5 py-3.5">
                {s.isActive && (
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                    onClick={() => void deactivate(s.id)}
                  >
                    Deactivate
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex justify-between">
              <h2 className="font-semibold">Add supplier</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <input className={inputClass} placeholder="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            <input className={inputClass} placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className={inputClass} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <PrimaryButton disabled={busy} onClick={create}>
              {busy ? "Saving…" : "Create"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
