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

type AccountRow = {
  id: string;
  accountCode: string;
  accountName: string;
  parentId: string | null;
  parentCode: string | null;
  parentName: string | null;
  accountType: string;
  normalBalance: string;
  isPostable: boolean;
  isActive: boolean;
  description: string | null;
};

const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

const NORMAL_FOR_TYPE: Record<string, string> = {
  ASSET: "DEBIT",
  EXPENSE: "DEBIT",
  LIABILITY: "CREDIT",
  EQUITY: "CREDIT",
  REVENUE: "CREDIT",
};

export default function BillingAccountsPage() {
  const { user } = useAuth();
  const canEdit =
    user?.role === "ACCOUNTANT" ||
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN";

  const [rows, setRows] = useState<AccountRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const [typeFilter, setTypeFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState("ASSET");
  const [parentId, setParentId] = useState("");
  const [description, setDescription] = useState("");
  const [isPostable, setIsPostable] = useState(true);
  const [parentOptions, setParentOptions] = useState<AccountRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildListQuery({
        page,
        limit: 50,
        search: search || undefined,
        accountType: typeFilter || undefined,
      });
      const res = unwrapPage<AccountRow>(await api(`/billing/accounts?${qs}`));
      setRows(res.items);
      setTotal(res.total);
      setLimit(res.limit);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load accounts");
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = async () => {
    setFormError("");
    setCode("");
    setName("");
    setAccountType("ASSET");
    setParentId("");
    setDescription("");
    setIsPostable(true);
    setOpen(true);
    try {
      const qs = buildListQuery({ page: 1, limit: 100, active: true });
      const res = unwrapPage<AccountRow>(await api(`/billing/accounts?${qs}`));
      setParentOptions(res.items);
    } catch {
      setParentOptions([]);
    }
  };

  const create = async () => {
    if (!code.trim() || !name.trim()) {
      setFormError("Code and name are required.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api("/billing/accounts", {
        method: "POST",
        body: JSON.stringify({
          accountCode: code.trim(),
          accountName: name.trim(),
          accountType,
          normalBalance: NORMAL_FOR_TYPE[accountType] ?? "DEBIT",
          parentId: parentId || undefined,
          description: description.trim() || undefined,
          isPostable,
        }),
      });
      setOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  };

  const meta = toPageMeta({ total, page, limit });

  return (
    <RoleGuard module="billing-ledger">
      <PageHeader
        title="Accounts"
        subtitle={loading ? "Loading…" : `${total.toLocaleString()} chart accounts`}
        action={
          canEdit ? (
            <PrimaryButton onClick={() => void openCreate()}>
              <Plus className="h-4 w-4" /> Add account
            </PrimaryButton>
          ) : undefined
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className={`min-w-[220px] flex-1 ${inputClass}`}
          placeholder="Search accounts…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={`w-44 ${inputClass}`}
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All types</option>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <Card>
        <CardHeader title="Chart of accounts" subtitle={`${total.toLocaleString()} records`} />
        <Table headers={["Code", "Name", "Type", "Parent", "Balance", "Flags"]}>
          {rows.map((a) => (
            <tr key={a.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 font-semibold text-slate-800">{a.accountCode}</td>
              <td className="px-5 py-3.5 text-slate-700">
                {a.accountName}
                {a.description && (
                  <span className="block text-xs text-slate-400">{a.description}</span>
                )}
              </td>
              <td className="px-5 py-3.5 text-slate-500">{a.accountType}</td>
              <td className="px-5 py-3.5 text-slate-500">
                {a.parentCode ? `${a.parentCode} · ${a.parentName}` : "—"}
              </td>
              <td className="px-5 py-3.5 text-slate-500">{a.normalBalance}</td>
              <td className="px-5 py-3.5">
                <div className="flex flex-wrap gap-1">
                  <Badge tone={a.isActive ? "green" : "slate"}>
                    {a.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {a.isPostable && <Badge tone="blue">Postable</Badge>}
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 && !loading && (
          <p className="px-5 pb-5 text-sm text-slate-400">No accounts found.</p>
        )}
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Add account</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div>
              <FieldLabel required>Code</FieldLabel>
              <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div>
              <FieldLabel required>Name</FieldLabel>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <FieldLabel required>Type</FieldLabel>
              <select
                className={inputClass}
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel optional>Parent account</FieldLabel>
              <select
                className={inputClass}
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">None</option>
                {parentOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountCode} · {a.accountName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel optional>Description</FieldLabel>
              <input
                className={inputClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={isPostable}
                onChange={(e) => setIsPostable(e.target.checked)}
              />
              Postable
            </label>
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
