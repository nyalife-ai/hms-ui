"use client";

import { Eye, FileText, RotateCcw, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PaginationBar } from "@/components/pagination-bar";
import { RoleGuard } from "@/components/role-guard";
import { TableAction } from "@/components/table-action";
import {
  Badge,
  Card,
  CardHeader,
  PageHeader,
  StatCard,
  Table,
  type BadgeTone,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { buildListQuery, toPageMeta, unwrapPage } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type JournalRow = {
  id: string;
  entryNumber: string;
  entryDate: string;
  status: string;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  postedAt: string | null;
};

type JournalLine = {
  id: string;
  accountCode: string;
  accountName: string;
  direction: string;
  amount: string;
  description: string | null;
};

type JournalDetail = JournalRow & {
  postingPeriodName?: string;
  lines: JournalLine[];
};

const STATUS_TONES: Record<string, BadgeTone> = {
  DRAFT: "slate",
  POSTED: "green",
  REVERSED: "amber",
};

function formatKes(v: string | number) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v);
}

function formatDate(v: string | null | undefined) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString();
  } catch {
    return String(v);
  }
}

export default function BillingJournalsPage() {
  const { user } = useAuth();
  const canPost =
    user?.role === "ACCOUNTANT" ||
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN";

  const [rows, setRows] = useState<JournalRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<JournalDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [kpi, setKpi] = useState<{
    total: number;
    draft: number;
    posted: number;
    reversed: number;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildListQuery({
        page,
        limit: 50,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      const [res, summary] = await Promise.all([
        unwrapPage<JournalRow>(await api(`/billing/journals?${qs}`)),
        api<{
          total: number;
          draft: number;
          posted: number;
          reversed: number;
        }>("/billing/journals/summary").catch(() => null),
      ]);
      setRows(res.items);
      setTotal(res.total);
      setLimit(res.limit);
      if (summary) setKpi(summary);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load journals");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const viewLines = async (id: string) => {
    setDetailLoading(true);
    try {
      setDetail(await api<JournalDetail>(`/billing/journals/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load journal entry");
    } finally {
      setDetailLoading(false);
    }
  };

  const post = async (id: string) => {
    setActionBusy(id);
    try {
      await api(`/billing/journals/${id}/post`, { method: "POST" });
      await load();
      if (detail?.id === id) await viewLines(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post journal");
    } finally {
      setActionBusy("");
    }
  };

  const reverse = async (id: string) => {
    const reason = window.prompt("Reason for reversing this entry? (optional)") ?? "";
    setActionBusy(id);
    try {
      await api(`/billing/journals/${id}/reverse`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      await load();
      if (detail?.id === id) await viewLines(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reverse journal");
    } finally {
      setActionBusy("");
    }
  };

  const meta = toPageMeta({ total, page, limit });

  return (
    <RoleGuard module="billing-ledger">
      <PageHeader
        title="Journals"
        subtitle={loading ? "Loading…" : `${total.toLocaleString()} journal entries`}
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total"
          value={kpi ? String(kpi.total) : "…"}
          deltaLabel="journal entries"
          icon={FileText}
        />
        <StatCard
          label="Draft"
          value={kpi ? String(kpi.draft) : "…"}
          deltaLabel="not posted"
          icon={Eye}
        />
        <StatCard
          label="Posted"
          value={kpi ? String(kpi.posted) : "…"}
          deltaLabel="on the ledger"
          icon={Send}
        />
        <StatCard
          label="Reversed"
          value={kpi ? String(kpi.reversed) : "…"}
          deltaLabel="correcting entries"
          icon={RotateCcw}
        />
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className={`min-w-[220px] flex-1 ${inputClass}`}
          placeholder="Search entry # or description…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={`w-40 ${inputClass}`}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {["DRAFT", "POSTED", "REVERSED"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <Card>
        <CardHeader title="Journal entries" subtitle={`${total.toLocaleString()} records`} />
        <Table headers={["Entry", "Date", "Description", "Reference", "Status", ""]}>
          {rows.map((j) => (
            <tr key={j.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 font-semibold text-slate-800">{j.entryNumber}</td>
              <td className="px-5 py-3.5 text-slate-500">{formatDate(j.entryDate)}</td>
              <td className="px-5 py-3.5 text-slate-600">{j.description || "—"}</td>
              <td className="px-5 py-3.5 text-slate-500">
                {j.referenceType
                  ? `${j.referenceType}${j.referenceId ? ` · ${j.referenceId.slice(0, 8)}…` : ""}`
                  : "—"}
              </td>
              <td className="px-5 py-3.5">
                <Badge tone={STATUS_TONES[j.status] ?? "slate"}>{j.status}</Badge>
              </td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-1">
                  <TableAction
                    icon={Eye}
                    label="View lines"
                    onClick={() => void viewLines(j.id)}
                  />
                  {canPost && j.status === "DRAFT" && (
                    <TableAction
                      icon={Send}
                      label="Post entry"
                      tone="add"
                      disabled={actionBusy === j.id}
                      onClick={() => void post(j.id)}
                    />
                  )}
                  {canPost && j.status === "POSTED" && (
                    <TableAction
                      icon={RotateCcw}
                      label="Reverse entry"
                      tone="danger"
                      disabled={actionBusy === j.id}
                      onClick={() => void reverse(j.id)}
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 && !loading && (
          <p className="px-5 pb-5 text-sm text-slate-400">No journal entries found.</p>
        )}
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </Card>

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">
                  {detail?.entryNumber ?? "Journal entry"}
                </h2>
                {detail && (
                  <p className="text-xs text-slate-400">
                    {formatDate(detail.entryDate)}
                    {detail.postingPeriodName ? ` · ${detail.postingPeriodName}` : ""}
                    {detail.description ? ` · ${detail.description}` : ""}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                onClick={() => setDetail(null)}
              >
                Close
              </button>
            </div>
            {detailLoading && !detail ? (
              <p className="text-sm text-slate-400">Loading lines…</p>
            ) : (
              <Table headers={["Account", "Direction", "Amount", "Note"]}>
                {(detail?.lines ?? []).map((l) => (
                  <tr key={l.id}>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      {l.accountCode} · {l.accountName}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">{l.direction}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{formatKes(l.amount)}</td>
                    <td className="px-5 py-3 text-sm text-slate-400">{l.description || "—"}</td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
