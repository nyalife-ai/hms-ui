"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { useAuth } from "@/lib/auth";
import { buildListQuery, toPageMeta, unwrapPage } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type TaxRateRow = {
  id: string;
  taxName: string;
  taxCode: string;
  ratePercentage: string;
  liabilityAccountId: string;
  liabilityAccountCode: string;
  isActive: boolean;
};

type AccountOpt = {
  id: string;
  accountCode: string;
  accountName: string;
  isPostable: boolean;
  isActive: boolean;
};

export default function BillingTaxRatesPage() {
  const { user } = useAuth();
  const canEdit =
    user?.role === "ACCOUNTANT" ||
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN";

  const [rows, setRows] = useState<TaxRateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [taxName, setTaxName] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [rate, setRate] = useState("");
  const [liabilityAccountId, setLiabilityAccountId] = useState("");
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildListQuery({
        page,
        limit: 50,
        search: search || undefined,
      });
      const res = unwrapPage<TaxRateRow>(await api(`/billing/tax-rates?${qs}`));
      setRows(res.items);
      setTotal(res.total);
      setLimit(res.limit);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load tax rates");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = async () => {
    setFormError("");
    setTaxName("");
    setTaxCode("");
    setRate("");
    setLiabilityAccountId("");
    setOpen(true);
    try {
      const qs = buildListQuery({
        page: 1,
        limit: 100,
        accountType: "LIABILITY",
        active: true,
        postable: true,
      });
      const res = unwrapPage<AccountOpt>(await api(`/billing/accounts?${qs}`));
      setAccounts(res.items);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to load liability accounts");
    }
  };

  const create = async () => {
    if (!taxName.trim() || !taxCode.trim()) {
      setFormError("Name and code are required.");
      return;
    }
    const ratePercentage = Number(rate);
    if (!Number.isFinite(ratePercentage) || ratePercentage < 0) {
      setFormError("Enter a valid rate percentage.");
      return;
    }
    if (!liabilityAccountId) {
      setFormError("Select a liability account.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api("/billing/tax-rates", {
        method: "POST",
        body: JSON.stringify({
          taxName: taxName.trim(),
          taxCode: taxCode.trim(),
          ratePercentage,
          liabilityAccountId,
        }),
      });
      setOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create tax rate");
    } finally {
      setBusy(false);
    }
  };

  const meta = toPageMeta({ total, page, limit });

  return (
    <RoleGuard module="billing-ledger">
      <PageHeader
        title="Tax rates"
        subtitle={loading ? "Loading…" : `${total.toLocaleString()} tax rates`}
        action={
          canEdit ? (
            <PrimaryButton onClick={() => void openCreate()}>
              <Plus className="h-4 w-4" /> Add tax rate
            </PrimaryButton>
          ) : undefined
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <div className="mb-4">
        <input
          className={inputClass}
          placeholder="Search tax rates…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <Card>
        <CardHeader title="Tax rates" subtitle={`${total.toLocaleString()} records`} />
        <Table headers={["Code", "Name", "Rate %", "Liability account", "Status"]}>
          {rows.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 font-semibold text-slate-800">{t.taxCode}</td>
              <td className="px-5 py-3.5 text-slate-700">{t.taxName}</td>
              <td className="px-5 py-3.5 text-slate-600">{t.ratePercentage}</td>
              <td className="px-5 py-3.5 text-slate-500">{t.liabilityAccountCode}</td>
              <td className="px-5 py-3.5">
                <Badge tone={t.isActive ? "green" : "slate"}>
                  {t.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 && !loading && (
          <p className="px-5 pb-5 text-sm text-slate-400">No tax rates found.</p>
        )}
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Add tax rate</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div>
              <FieldLabel required>Code</FieldLabel>
              <input className={inputClass} value={taxCode} onChange={(e) => setTaxCode(e.target.value)} />
            </div>
            <div>
              <FieldLabel required>Name</FieldLabel>
              <input className={inputClass} value={taxName} onChange={(e) => setTaxName(e.target.value)} />
            </div>
            <div>
              <FieldLabel required>Rate %</FieldLabel>
              <input
                className={inputClass}
                type="number"
                min={0}
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel required>Liability account</FieldLabel>
              <select
                className={inputClass}
                value={liabilityAccountId}
                onChange={(e) => setLiabilityAccountId(e.target.value)}
              >
                <option value="">Select account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountCode} · {a.accountName}
                  </option>
                ))}
              </select>
            </div>
            {formError && <p className="text-[11px] font-medium text-rose-500">{formError}</p>}
            <PrimaryButton disabled={busy} onClick={create}>
              {busy ? "Saving…" : "Create"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
