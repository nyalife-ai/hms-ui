"use client";

import { ArrowLeft, CheckCircle2, Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import {
  Badge,
  Card,
  CardHeader,
  PageHeader,
  PrimaryButton,
  type BadgeTone,
} from "@/components/ui";
import { api } from "@/lib/api";
import { fetchHospitalSettings } from "@/lib/hospital";
import { openLabReportPdf, printLabReportPdf } from "@/lib/lab-report-pdf";
import type { LabRequestDetail } from "@/lib/lab-types";
import { statusLabel } from "@/lib/lab-types";

const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "amber",
  IN_PROGRESS: "teal",
  COMPLETED: "green",
  CANCELLED: "slate",
};

function tone(interp: string | null): BadgeTone {
  if (interp === "CRITICAL") return "red";
  if (interp === "HIGH" || interp === "LOW") return "amber";
  return "green";
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function LabResultDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [detail, setDetail] = useState<LabRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const d = await api<LabRequestDetail>(`/laboratory/results/${id}`);
      setDetail(d);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load results");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const panels = useMemo(() => {
    if (!detail) return [] as Array<{ name: string; lines: LabRequestDetail["results"] }>;
    const map = new Map<string, LabRequestDetail["results"]>();
    for (const r of detail.results) {
      const key = r.testName || "Investigations";
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return [...map.entries()].map(([name, lines]) => ({ name, lines }));
  }, [detail]);

  const runPdf = async (mode: "open" | "print") => {
    if (!detail) return;
    setBusy(true);
    try {
      const hospital = await fetchHospitalSettings();
      if (mode === "print") await printLabReportPdf({ detail, hospital });
      else await openLabReportPdf({ detail, hospital });
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF failed");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (resultId: string) => {
    if (!detail) return;
    setBusy(true);
    try {
      await api(`/laboratory/requests/${detail.id}/results/${resultId}/verify`, {
        method: "POST",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <RoleGuard module="laboratory">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Home / Dashboard / Lab Results / {detail?.requestNumber ?? "…"}
      </div>
      <PageHeader
        title={detail?.requestNumber ?? "Lab results"}
        subtitle={
          detail
            ? `${detail.patientName} · ${detail.mrn ?? "—"} · ${detail.resultCount} parameter${detail.resultCount === 1 ? "" : "s"}`
            : loading
              ? "Loading…"
              : "Result report"
        }
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !detail?.results.length}
              onClick={() => void runPdf("open")}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-300 disabled:opacity-40"
            >
              <Printer className="h-3.5 w-3.5" /> Open PDF
            </button>
            <PrimaryButton
              disabled={busy || !detail?.results.length}
              onClick={() => void runPdf("print")}
            >
              <Printer className="h-4 w-4" /> Print
            </PrimaryButton>
            <Link
              href="/laboratory/results"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Link>
          </div>
        }
      />

      {error && <p className="mb-3 text-sm text-rose-500">{error}</p>}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      )}

      {detail && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Status", node: <Badge tone={STATUS_TONE[detail.status] ?? "slate"}>{statusLabel(detail.status)}</Badge> },
              { label: "Verified", value: `${detail.verifiedCount}/${detail.resultCount}` },
              { label: "Critical flags", value: String(detail.criticalCount) },
              { label: "Reported", value: formatWhen(detail.updatedAt) },
            ].map((s) => (
              <Card key={s.label} className="p-4">
                <p className="text-xs text-slate-400">{s.label}</p>
                <div className="mt-1">
                  {"node" in s && s.node
                    ? s.node
                    : <p className="text-lg font-bold text-slate-900">{"value" in s ? s.value : ""}</p>}
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-5">
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-400">Patient</p>
                <p className="font-semibold text-slate-900">{detail.patientName}</p>
                <p className="text-xs text-slate-400">{detail.mrn}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Physician</p>
                <p className="font-medium text-slate-800">
                  {detail.requestingDoctor || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Request</p>
                <Link
                  href={`/laboratory/requests/${detail.id}`}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {detail.requestNumber}
                </Link>
              </div>
            </div>
          </Card>

          {panels.map((panel) => (
            <Card key={panel.name}>
              <CardHeader title={panel.name} subtitle={`${panel.lines.length} parameter(s)`} />
              <div className="grid grid-cols-1 gap-3 px-5 pb-5 md:grid-cols-2">
                {panel.lines.map((r) => (
                  <div
                    key={r.id}
                    className={`rounded-2xl border px-4 py-3 ${r.isCritical ? "border-rose-200 bg-rose-50/40" : "border-slate-100 bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {r.parameterName}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Ref {r.normalReferenceRange || "—"} · {r.unitOfMeasurement || "—"}
                        </p>
                      </div>
                      <Badge tone={tone(r.interpretation)}>{r.interpretation}</Badge>
                    </div>
                    <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                      {r.resultValue ?? "—"}
                      {r.unitOfMeasurement ? (
                        <span className="ml-1 text-sm font-medium text-slate-400">
                          {r.unitOfMeasurement}
                        </span>
                      ) : null}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      {r.isVerified ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Verified {formatWhen(r.verifiedAt)}
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700"
                          onClick={() => void verify(r.id)}
                        >
                          Verify
                        </button>
                      )}
                      {r.performedAt && <span>Entered {formatWhen(r.performedAt)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}

          {(detail.observations || detail.conclusion || detail.notes) && (
            <Card className="p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Notes & conclusion</h3>
              {detail.notes && (
                <p className="text-sm text-slate-600">
                  <span className="font-medium text-slate-800">Clinical: </span>
                  {detail.notes}
                </p>
              )}
              {detail.observations && (
                <p className="text-sm text-slate-600">
                  <span className="font-medium text-slate-800">Observations: </span>
                  {detail.observations}
                </p>
              )}
              {detail.conclusion && (
                <p className="text-sm text-slate-600">
                  <span className="font-medium text-slate-800">Conclusion: </span>
                  {detail.conclusion}
                </p>
              )}
            </Card>
          )}
        </div>
      )}
    </RoleGuard>
  );
}
