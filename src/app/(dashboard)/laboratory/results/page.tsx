"use client";

import { ClipboardCheck, ClipboardList, FlaskConical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LabResultRowActions } from "@/components/lab-result-row-actions";
import { PaginationBar } from "@/components/pagination-bar";
import { RoleGuard } from "@/components/role-guard";
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
import { fetchHospitalSettings } from "@/lib/hospital";
import { openLabReportPdf } from "@/lib/lab-report-pdf";
import type { LabRequestDetail, LabResultBundle } from "@/lib/lab-types";
import { statusLabel } from "@/lib/lab-types";
import { buildListQuery, toPageMeta, unwrapPage } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "amber",
  IN_PROGRESS: "teal",
  COMPLETED: "green",
  CANCELLED: "slate",
};

const PAGE_SIZE = 20;

type Summary = {
  total: number;
  completedToday: number;
  completedThisWeek: number;
};

export default function LabResultsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<LabResultBundle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [unverifiedOnly, setUnverifiedOnly] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const [printBusy, setPrintBusy] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("critical") === "1") setCriticalOnly(true);
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const s = await api<Summary>("/laboratory/results/summary");
      setSummary(s);
    } catch {
      setSummary({ total: 0, completedToday: 0, completedThisWeek: 0 });
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildListQuery({
        search: search || undefined,
        status: status || undefined,
        criticalOnly: criticalOnly ? "true" : undefined,
        unverifiedOnly: unverifiedOnly ? "true" : undefined,
        page,
        limit: PAGE_SIZE,
      });
      const data = await api(`/laboratory/results/bundles?${qs}`);
      const pageData = unwrapPage<LabResultBundle>(data);
      setRows(pageData.items);
      setTotal(pageData.total);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [search, status, criticalOnly, unverifiedOnly, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const printBundle = async (requestId: string) => {
    setPrintBusy(requestId);
    try {
      const [detail, hospital] = await Promise.all([
        api<LabRequestDetail>(`/laboratory/results/${requestId}`),
        fetchHospitalSettings(),
      ]);
      await openLabReportPdf({ detail, hospital });
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF failed");
    } finally {
      setPrintBusy("");
    }
  };

  const meta = toPageMeta({ total, page, limit: PAGE_SIZE });
  const kpi = summary ?? { total: 0, completedToday: 0, completedThisWeek: 0 };

  return (
    <RoleGuard module="laboratory">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-foreground-lighter">
        Home / Dashboard / Lab Results
      </div>
      <PageHeader
        title="Lab Results"
        subtitle={
          loading
            ? "Loading…"
            : `${total.toLocaleString()} result report${total === 1 ? "" : "s"} · one row per lab request`
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total Results"
          value={summaryLoading ? "…" : String(kpi.total)}
          deltaLabel="requests with entered results"
          icon={FlaskConical}
        />
        <StatCard
          label="Completed Today"
          value={summaryLoading ? "…" : String(kpi.completedToday)}
          deltaLabel="finalised today"
          icon={ClipboardCheck}
        />
        <StatCard
          label="Completed This Week"
          value={summaryLoading ? "…" : String(kpi.completedThisWeek)}
          deltaLabel="since start of week"
          icon={ClipboardList}
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-4">
        <input
          className={inputClass}
          placeholder="Search request # / patient / MRN"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={inputClass}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground-light">
          <input
            type="checkbox"
            checked={criticalOnly}
            onChange={(e) => {
              setCriticalOnly(e.target.checked);
              setPage(1);
            }}
          />
          Critical only
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground-light">
          <input
            type="checkbox"
            checked={unverifiedOnly}
            onChange={(e) => {
              setUnverifiedOnly(e.target.checked);
              setPage(1);
            }}
          />
          Unverified only
        </label>
      </div>

      <Card>
        <CardHeader
          title="Results by request"
          subtitle={`${total.toLocaleString()} total`}
        />
        <Table
          headers={[
            "Request",
            "Patient",
            "Panels",
            "Results",
            "Verification",
            "Status",
            "Updated",
            "",
          ]}
        >
          {rows.map((r) => (
            <tr
              key={r.id}
              className={`hover:bg-surface-200/60 ${r.criticalCount > 0 ? "bg-rose-50/30" : ""}`}
            >
              <td className="px-5 py-3.5 font-medium text-foreground">
                {r.requestNumber}
              </td>
              <td className="px-5 py-3.5 text-foreground-light">
                {r.patientName}
                <span className="block text-xs text-foreground-lighter">{r.mrn}</span>
              </td>
              <td className="px-5 py-3.5 text-foreground-light text-xs">
                {r.panels.length ? r.panels.join(", ") : "—"}
              </td>
              <td className="px-5 py-3.5 text-foreground">
                {r.resultCount}
                {r.criticalCount > 0 && (
                  <span className="ml-1 text-xs text-rose-500">
                    · {r.criticalCount} critical
                  </span>
                )}
              </td>
              <td className="px-5 py-3.5">
                <Badge tone={r.allVerified ? "green" : "amber"}>
                  {r.verifiedCount}/{r.resultCount}
                  {r.allVerified ? " verified" : " pending"}
                </Badge>
              </td>
              <td className="px-5 py-3.5">
                <Badge tone={STATUS_TONE[r.status] ?? "slate"}>
                  {statusLabel(r.status)}
                </Badge>
              </td>
              <td className="px-5 py-3.5 text-xs text-foreground-light">
                {r.updatedAt.slice(0, 10)}
              </td>
              <td className="px-5 py-3.5">
                <LabResultRowActions
                  printDisabled={printBusy === r.id || r.resultCount === 0}
                  onPrint={() => void printBundle(r.id)}
                  onView={() => router.push(`/laboratory/results/${r.id}`)}
                />
              </td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 && !loading && (
          <p className="px-5 pb-5 text-sm text-foreground-lighter">
            No result reports match filters.
          </p>
        )}
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </Card>
    </RoleGuard>
  );
}
