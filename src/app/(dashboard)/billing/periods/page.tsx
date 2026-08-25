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
  type BadgeTone,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { buildListQuery, toPageMeta, unwrapPage } from "@/lib/pagination";

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

/** Backend may return camelCase or raw prisma snake_case for periods. */
type PeriodRow = {
  id: string;
  periodName?: string;
  period_name?: string;
  startDate?: string;
  start_date?: string;
  endDate?: string;
  end_date?: string;
  fiscalYear?: number;
  fiscal_year?: number;
  status: string;
};

const STATUS_TONES: Record<string, BadgeTone> = {
  OPEN: "green",
  CLOSED: "amber",
  LOCKED: "slate",
};

function periodName(p: PeriodRow) {
  return p.periodName ?? p.period_name ?? "—";
}

function fiscalYear(p: PeriodRow) {
  return p.fiscalYear ?? p.fiscal_year ?? "—";
}

function formatDate(v: string | null | undefined) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString();
  } catch {
    return String(v);
  }
}

function startDate(p: PeriodRow) {
  return formatDate(p.startDate ?? p.start_date);
}

function endDate(p: PeriodRow) {
  return formatDate(p.endDate ?? p.end_date);
}

export default function BillingPeriodsPage() {
  const { user } = useAuth();
  const canEdit =
    user?.role === "ACCOUNTANT" ||
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN";

  const [rows, setRows] = useState<PeriodRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [actionBusy, setActionBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildListQuery({
        page,
        limit: 50,
        status: statusFilter || undefined,
      });
      const res = unwrapPage<PeriodRow>(await api(`/billing/posting-periods?${qs}`));
      setRows(res.items);
      setTotal(res.total);
      setLimit(res.limit);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load posting periods");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim() || !start || !end) {
      setFormError("Name, start, and end dates are required.");
      return;
    }
    const fiscalYearNum = Number(year);
    if (!Number.isFinite(fiscalYearNum)) {
      setFormError("Enter a valid fiscal year.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api("/billing/posting-periods", {
        method: "POST",
        body: JSON.stringify({
          periodName: name.trim(),
          startDate: start,
          endDate: end,
          fiscalYear: fiscalYearNum,
        }),
      });
      setOpen(false);
      setName("");
      setStart("");
      setEnd("");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create period");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: "OPEN" | "CLOSED" | "LOCKED") => {
    setActionBusy(id);
    try {
      await api(`/billing/posting-periods/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update period status");
    } finally {
      setActionBusy("");
    }
  };

  const meta = toPageMeta({ total, page, limit });

  return (
    <RoleGuard module="billing-ledger">
      <PageHeader
        title="Periods"
        subtitle={loading ? "Loading…" : `${total.toLocaleString()} posting periods`}
        action={
          canEdit ? (
            <PrimaryButton
              onClick={() => {
                setFormError("");
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add period
            </PrimaryButton>
          ) : undefined
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <div className="mb-4">
        <select
          className={`w-48 ${inputClass}`}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {["OPEN", "CLOSED", "LOCKED"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <Card>
        <CardHeader title="Posting periods" subtitle={`${total.toLocaleString()} records`} />
        <Table
          headers={[
            "Period",
            "Fiscal year",
            "Start",
            "End",
            "Status",
            ...(canEdit ? [""] : []),
          ]}
        >
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-surface-200/60">
              <td className="px-5 py-3.5 font-semibold text-foreground">{periodName(p)}</td>
              <td className="px-5 py-3.5 text-foreground-light">{fiscalYear(p)}</td>
              <td className="px-5 py-3.5 text-foreground-light">{startDate(p)}</td>
              <td className="px-5 py-3.5 text-foreground-light">{endDate(p)}</td>
              <td className="px-5 py-3.5">
                <Badge tone={STATUS_TONES[p.status] ?? "slate"}>{p.status}</Badge>
              </td>
              {canEdit && (
                <td className="px-5 py-3.5">
                  <div className="flex flex-wrap gap-1">
                    {p.status !== "OPEN" && (
                      <button
                        type="button"
                        disabled={actionBusy === p.id}
                        onClick={() => void setStatus(p.id, "OPEN")}
                        className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground-light hover:border-brand-300 disabled:opacity-50"
                      >
                        Open
                      </button>
                    )}
                    {p.status === "OPEN" && (
                      <button
                        type="button"
                        disabled={actionBusy === p.id}
                        onClick={() => void setStatus(p.id, "CLOSED")}
                        className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground-light hover:border-brand-300 disabled:opacity-50"
                      >
                        Close
                      </button>
                    )}
                    {p.status !== "LOCKED" && (
                      <button
                        type="button"
                        disabled={actionBusy === p.id}
                        onClick={() => void setStatus(p.id, "LOCKED")}
                        className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground-light hover:border-brand-300 disabled:opacity-50"
                      >
                        Lock
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </Table>
        {rows.length === 0 && !loading && (
          <p className="px-5 pb-5 text-sm text-foreground-lighter">No posting periods found.</p>
        )}
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Add posting period</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-4 w-4 text-foreground-lighter" />
              </button>
            </div>
            <div>
              <FieldLabel required>Name</FieldLabel>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aug 2026"
              />
            </div>
            <div>
              <FieldLabel required>Fiscal year</FieldLabel>
              <input
                className={inputClass}
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel required>Start date</FieldLabel>
              <input
                className={inputClass}
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel required>End date</FieldLabel>
              <input
                className={inputClass}
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
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
