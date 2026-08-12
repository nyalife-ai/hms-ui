"use client";

import { CheckCircle2, ClipboardList, FileWarning, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FieldLabel } from "@/components/field-label";
import { PaginationBar } from "@/components/pagination-bar";
import { RoleGuard } from "@/components/role-guard";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  PageHeader,
  PrimaryButton,
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

type ClaimRow = {
  id: string;
  claimNumber: string;
  invoiceNumber: string;
  patientName: string;
  patientMrn: string;
  amountClaimed: string;
  amountApproved: string | null;
  amountPaid: string | null;
  status: string;
  submissionDate: string | null;
};

const STATUS_TONES: Record<string, BadgeTone> = {
  DRAFT: "slate",
  SUBMITTED: "blue",
  UNDER_REVIEW: "amber",
  APPROVED: "teal",
  PARTIALLY_PAID: "amber",
  PAID: "green",
  DENIED: "red",
};

const NEXT_STATUS: Record<string, string[]> = {
  DRAFT: ["SUBMITTED", "DENIED"],
  SUBMITTED: ["UNDER_REVIEW", "APPROVED", "DENIED"],
  UNDER_REVIEW: ["APPROVED", "DENIED", "PARTIALLY_PAID", "PAID"],
  APPROVED: ["PARTIALLY_PAID", "PAID", "DENIED"],
  PARTIALLY_PAID: ["PAID"],
};

function formatKes(v: string | number | null | undefined) {
  if (v == null) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v);
}

export default function BillingClaimsPage() {
  const { user } = useAuth();
  const canTransition =
    user?.role === "ACCOUNTANT" ||
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN";

  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [actionClaim, setActionClaim] = useState<ClaimRow | null>(null);
  const [nextStatus, setNextStatus] = useState("");
  const [amountApproved, setAmountApproved] = useState("");
  const [denialReason, setDenialReason] = useState("");
  const [formError, setFormError] = useState("");
  const [kpi, setKpi] = useState<{
    total: number;
    draft: number;
    inFlight: number;
    approved: number;
    denied: number;
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
        unwrapPage<ClaimRow>(await api(`/billing/claims?${qs}`)),
        api<{
          total: number;
          draft: number;
          inFlight: number;
          approved: number;
          denied: number;
        }>("/billing/claims/summary").catch(() => null),
      ]);
      setRows(res.items);
      setTotal(res.total);
      setLimit(res.limit);
      if (summary) setKpi(summary);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load claims");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAction = (claim: ClaimRow) => {
    const options = NEXT_STATUS[claim.status] ?? [];
    if (!options.length) return;
    setActionClaim(claim);
    setNextStatus(options[0]);
    setAmountApproved(claim.amountApproved ?? claim.amountClaimed);
    setDenialReason("");
    setFormError("");
  };

  const applyStatus = async () => {
    if (!actionClaim || !nextStatus) return;
    if (nextStatus === "DENIED" && !denialReason.trim()) {
      setFormError("Enter a denial reason.");
      return;
    }
    setBusyId(actionClaim.id);
    setFormError("");
    try {
      await api(`/billing/claims/${actionClaim.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: nextStatus,
          amountApproved:
            nextStatus === "APPROVED" ||
            nextStatus === "PARTIALLY_PAID" ||
            nextStatus === "PAID"
              ? amountApproved || undefined
              : undefined,
          denialReason: nextStatus === "DENIED" ? denialReason.trim() : undefined,
        }),
      });
      setActionClaim(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not update claim");
    } finally {
      setBusyId("");
    }
  };

  const meta = toPageMeta({ total, page, limit });

  return (
    <RoleGuard module="billing">
      <PageHeader
        title="Claims"
        subtitle={loading ? "Loading…" : `${total.toLocaleString()} insurance claims`}
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Draft"
          value={kpi ? String(kpi.draft) : "…"}
          deltaLabel="not submitted"
          icon={ClipboardList}
        />
        <StatCard
          label="In flight"
          value={kpi ? String(kpi.inFlight) : "…"}
          deltaLabel="submitted / under review"
          icon={Send}
        />
        <StatCard
          label="Approved"
          value={kpi ? String(kpi.approved) : "…"}
          deltaLabel="payer accepted"
          icon={CheckCircle2}
        />
        <StatCard
          label="Denied"
          value={kpi ? String(kpi.denied) : "…"}
          deltaLabel="rejected by payer"
          icon={FileWarning}
        />
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className={`min-w-[220px] flex-1 ${inputClass}`}
          placeholder="Search claim # or patient…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={`w-48 ${inputClass}`}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {Object.keys(STATUS_TONES).map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <Card>
        <CardHeader title="Insurance claims" subtitle={`${total.toLocaleString()} records`} />
        <Table
          headers={[
            "Claim",
            "Patient",
            "Invoice",
            "Claimed",
            "Approved",
            "Status",
            ...(canTransition ? [""] : []),
          ]}
        >
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 font-semibold text-slate-800">{c.claimNumber}</td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={c.patientName} size="sm" />
                  <div>
                    <p className="text-sm text-slate-700">{c.patientName}</p>
                    <p className="text-[11px] text-slate-400">{c.patientMrn}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3.5 text-slate-500">{c.invoiceNumber}</td>
              <td className="px-5 py-3.5 text-slate-600">{formatKes(c.amountClaimed)}</td>
              <td className="px-5 py-3.5 text-slate-600">{formatKes(c.amountApproved)}</td>
              <td className="px-5 py-3.5">
                <Badge tone={STATUS_TONES[c.status] ?? "slate"}>
                  {c.status.replaceAll("_", " ")}
                </Badge>
              </td>
              {canTransition && (
                <td className="px-5 py-3.5">
                  {(NEXT_STATUS[c.status]?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => openAction(c)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-brand-300 disabled:opacity-50"
                    >
                      Update status
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </Table>
        {rows.length === 0 && !loading && (
          <p className="px-5 pb-5 text-sm text-slate-400">No claims found.</p>
        )}
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </Card>

      {actionClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="font-semibold text-slate-900">
              Update {actionClaim.claimNumber}
            </h2>
            <div>
              <FieldLabel required>New status</FieldLabel>
              <select
                className={inputClass}
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value)}
              >
                {(NEXT_STATUS[actionClaim.status] ?? []).map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            {(nextStatus === "APPROVED" ||
              nextStatus === "PARTIALLY_PAID" ||
              nextStatus === "PAID") && (
              <div>
                <FieldLabel optional>Amount approved</FieldLabel>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  step="0.01"
                  value={amountApproved}
                  onChange={(e) => setAmountApproved(e.target.value)}
                />
              </div>
            )}
            {nextStatus === "DENIED" && (
              <div>
                <FieldLabel required>Denial reason</FieldLabel>
                <input
                  className={inputClass}
                  value={denialReason}
                  onChange={(e) => setDenialReason(e.target.value)}
                />
              </div>
            )}
            {formError && <p className="text-[11px] font-medium text-rose-500">{formError}</p>}
            <div className="flex gap-2">
              <PrimaryButton disabled={busyId === actionClaim.id} onClick={applyStatus}>
                {busyId === actionClaim.id ? "Saving…" : "Apply"}
              </PrimaryButton>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600"
                onClick={() => setActionClaim(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
