"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import {
  Badge,
  Card,
  CardHeader,
  PageHeader,
  Table,
  type BadgeTone,
} from "@/components/ui";
import { api } from "@/lib/api";
import { consultationJourneyHref } from "@/lib/clinical-links";
import { statusLabel } from "@/lib/lab-types";
import { buildListQuery, unwrapPage } from "@/lib/pagination";

const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "amber",
  IN_PROGRESS: "teal",
  COMPLETED: "green",
  CANCELLED: "slate",
};

const PRIORITY_TONE: Record<string, BadgeTone> = {
  NORMAL: "slate",
  URGENT: "amber",
  STAT: "red",
};

type RequestRow = {
  id: string;
  requestNumber: string | null;
  patientName: string;
  mrn: string | null;
  requestingDoctor: string | null;
  priority: string;
  status: string;
  requestDate: string;
};

function RelatedLabsInner() {
  const params = useSearchParams();
  const visitId = params.get("visitId") || "";
  const appointmentId = params.get("appointmentId") || "";
  const patient = params.get("patient") || "";
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!visitId && !appointmentId) {
      setRows([]);
      setLoading(false);
      setError("No visit or appointment was provided.");
      return;
    }
    setLoading(true);
    try {
      const qs = buildListQuery({
        visitId: visitId || undefined,
        appointmentId: appointmentId || undefined,
        page: 1,
        limit: 100,
      });
      const r = await api(`/laboratory/requests?${qs}`);
      setRows(unwrapPage<RequestRow>(r).items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lab requests");
    } finally {
      setLoading(false);
    }
  }, [visitId, appointmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const backHref = visitId ? consultationJourneyHref(visitId) : "/appointments";

  return (
    <RoleGuard modules={["consultations", "appointments", "laboratory"]}>
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Home / Laboratory / Related requests
      </div>
      <PageHeader
        title="Related lab requests"
        subtitle={
          loading
            ? "Loading…"
            : `${rows.length} request${rows.length === 1 ? "" : "s"}${
                patient ? ` · ${patient}` : ""
              }`
        }
        action={
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <Card>
        <CardHeader
          title="Requests for this visit"
          subtitle="Ordered from consultation — open a row to see samples and results"
        />
        <Table headers={["Request", "Patient", "Doctor", "Priority", "Status", "Date", ""]}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 font-medium text-slate-800">
                {r.requestNumber}
              </td>
              <td className="px-5 py-3.5 text-slate-500">
                {r.patientName}
                <span className="block text-xs text-slate-400">{r.mrn}</span>
              </td>
              <td className="px-5 py-3.5 text-slate-500">{r.requestingDoctor || "—"}</td>
              <td className="px-5 py-3.5">
                <Badge tone={PRIORITY_TONE[r.priority] ?? "slate"}>{r.priority}</Badge>
              </td>
              <td className="px-5 py-3.5">
                <Badge tone={STATUS_TONE[r.status] ?? "slate"}>
                  {statusLabel(r.status)}
                </Badge>
              </td>
              <td className="px-5 py-3.5 text-xs text-slate-500">
                {r.requestDate.slice(0, 10)}
              </td>
              <td className="px-5 py-3.5">
                <Link
                  href={`/laboratory/requests/${r.id}`}
                  className="rounded-full border px-3 py-1 text-xs font-medium text-slate-700 hover:border-brand-300"
                >
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </Table>
        {!loading && rows.length === 0 && !error && (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            No laboratory requests are linked to this appointment yet.
          </p>
        )}
      </Card>
    </RoleGuard>
  );
}

export default function RelatedLabsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
      <RelatedLabsInner />
    </Suspense>
  );
}
