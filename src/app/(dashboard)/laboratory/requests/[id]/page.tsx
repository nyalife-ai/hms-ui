"use client";

import {
  ArrowLeft,
  FlaskConical,
  Link2,
  Printer,
  Save,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FieldLabel } from "@/components/field-label";
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
import { openLabReportPdf } from "@/lib/lab-report-pdf";
import type { LabRequestDetail } from "@/lib/lab-types";
import { statusLabel } from "@/lib/lab-types";

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

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

function formatDay(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function LabRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [detail, setDetail] = useState<LabRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultValues, setResultValues] = useState<Record<string, string>>({});
  const [interpretations, setInterpretations] = useState<Record<string, string>>({});
  const [observations, setObservations] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [evidenceName, setEvidenceName] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [sampleType, setSampleType] = useState("BLOOD");
  const [sampleNotes, setSampleNotes] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const d = await api<LabRequestDetail>(`/laboratory/requests/${id}`);
      setDetail(d);
      const vals: Record<string, string> = {};
      const ints: Record<string, string> = {};
      for (const p of d.resultEntryParameters) {
        const existing = d.results.find((r) => r.parameterId === p.id);
        vals[p.id] = existing?.resultValue ?? "";
        ints[p.id] = existing?.interpretation ?? "NORMAL";
      }
      setResultValues(vals);
      setInterpretations(ints);
      setObservations(d.observations ?? "");
      setConclusion(d.conclusion ?? "");
      setEvidenceName(d.evidenceName ?? "");
      setClinicalNotes(d.notes ?? "");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load request");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const registerSample = async () => {
    if (!detail) return;
    const type = sampleType.trim();
    if (!type) {
      setError("Sample type is required");
      return;
    }
    setBusy(true);
    try {
      await api(`/laboratory/requests/${detail.id}/samples`, {
        method: "POST",
        body: JSON.stringify({
          sampleType: type,
          ...(sampleNotes.trim() ? { notes: sampleNotes.trim() } : {}),
        }),
      });
      setSampleNotes("");
      setError("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sample registration failed");
    } finally {
      setBusy(false);
    }
  };

  const saveResults = async () => {
    if (!detail) return;
    const lines = detail.resultEntryParameters
      .filter((p) => (resultValues[p.id] || "").trim())
      .map((p) => ({
        parameterId: p.id,
        resultValue: resultValues[p.id],
        interpretation: interpretations[p.id] || "NORMAL",
      }));
    if (!lines.length) return;
    setBusy(true);
    try {
      await api(`/laboratory/requests/${detail.id}/results`, {
        method: "POST",
        body: JSON.stringify({ lines }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Results failed");
    } finally {
      setBusy(false);
    }
  };

  const saveFindings = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await api(`/laboratory/requests/${detail.id}/findings`, {
        method: "PATCH",
        body: JSON.stringify({
          observations,
          conclusion,
          evidenceName,
          text: clinicalNotes,
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
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

  const releaseToDoctor = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await api(`/laboratory/requests/${detail.id}/release-to-doctor`, {
        method: "POST",
      });
      setError("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Release to doctor failed");
    } finally {
      setBusy(false);
    }
  };

  const printReport = async () => {
    if (!detail || !detail.results.length) return;
    setBusy(true);
    try {
      const hospital = await fetchHospitalSettings();
      await openLabReportPdf({ detail, hospital });
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF failed");
    } finally {
      setBusy(false);
    }
  };

  const category =
    detail?.categories?.[0] ||
    detail?.orderedTestTypes?.[0]?.category ||
    "Laboratory";

  return (
    <RoleGuard modules={["laboratory", "consultations", "appointments"]}>
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-foreground-lighter">
        Home / Laboratory / Requests / {detail?.requestNumber ?? "…"}
      </div>
      <PageHeader
        title={
          detail
            ? `Lab request — ${detail.requestNumber ?? "Request"}`
            : loading
              ? "Loading…"
              : "Lab request"
        }
        subtitle={
          detail
            ? `${detail.patientName} · ${detail.mrn ?? "—"} · ${statusLabel(detail.status)}`
            : "Request workflow, parameters, and findings"
        }
        action={
          <div className="flex flex-wrap gap-2">
            {detail && detail.results.length > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void printReport()}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-brand-300"
              >
                <Printer className="h-3.5 w-3.5" /> Print PDF
              </button>
            )}
            <Link
              href="/laboratory/requests"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-brand-300"
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
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-200" />
          ))}
        </div>
      )}

      {detail && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Status", value: statusLabel(detail.status), badge: detail.status },
              { label: "Priority", value: detail.priority, badgeP: detail.priority },
              { label: "Requested", value: formatDay(detail.requestDate), sub: formatWhen(detail.requestDate) },
              { label: "Category", value: category },
              { label: "Patient", value: detail.patientName, sub: `PAT-ID: ${detail.mrn ?? "—"}` },
              { label: "Phone", value: detail.patientPhone || "—", sub: detail.patientEmail || undefined },
            ].map((s) => (
              <Card key={s.label} className="p-4">
                <p className="text-xs text-foreground-lighter">{s.label}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {"badge" in s && s.badge ? (
                    <Badge tone={STATUS_TONE[s.badge] ?? "slate"}>{s.value}</Badge>
                  ) : "badgeP" in s && s.badgeP ? (
                    <Badge tone={PRIORITY_TONE[s.badgeP] ?? "slate"}>{s.value}</Badge>
                  ) : (
                    <p className="text-sm font-semibold text-foreground">{s.value}</p>
                  )}
                </div>
                {"sub" in s && s.sub && (
                  <p className="mt-1 text-[11px] text-foreground-lighter">{s.sub}</p>
                )}
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.1fr]">
            <Card className="p-5">
              <CardHeader
                title="Request workflow"
                subtitle={detail.requestNumber ?? undefined}
              />
              <dl className="mt-2 grid grid-cols-1 gap-3 px-5 pb-5 text-sm sm:grid-cols-2">
                {[
                  { k: "Status", v: statusLabel(detail.status) },
                  { k: "Priority", v: detail.priority },
                  {
                    k: "Ordering physician",
                    v: detail.requestingDoctor
                      ? `Dr. ${detail.requestingDoctor.replace(/^Dr\.?\s*/i, "")}`
                      : "—",
                  },
                  {
                    k: "Department",
                    v:
                      detail.requestingDoctorDepartment ||
                      detail.requestingDoctorSpecialization ||
                      "—",
                  },
                  { k: "Requested by", v: detail.requestedByName || "—" },
                  { k: "Assigned to", v: "NyaLife Lab" },
                  { k: "Request date", v: formatDay(detail.requestDate) },
                ].map((row) => (
                  <div key={row.k}>
                    <dt className="text-xs text-foreground-lighter">{row.k}</dt>
                    <dd className="mt-0.5 font-medium text-foreground">{row.v}</dd>
                  </div>
                ))}
              </dl>
              <div className="border-t border-border px-5 py-4">
                <FieldLabel optional>Clinical notes</FieldLabel>
                <textarea
                  className={`${inputClass} min-h-[80px]`}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  disabled={detail.status === "CANCELLED"}
                  placeholder="Requested during consultation…"
                />
              </div>
              <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
                {detail.consultationId && (
                  <Link
                    href={`/consultations`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-700"
                  >
                    <Link2 className="h-3.5 w-3.5" /> Related consultation
                  </Link>
                )}
                <Link
                  href={`/patients/${detail.patientId}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-700"
                >
                  Patient profile →
                </Link>
              </div>
            </Card>

            <Card className="p-5">
              <CardHeader title="Investigation parameters" subtitle={category} />
              <div className="space-y-3 px-5 pb-5">
                {detail.orderedTestTypes.length === 0 ? (
                  <p className="text-sm text-foreground-lighter">No panels linked on this request.</p>
                ) : (
                  detail.orderedTestTypes.map((panel) => (
                    <div
                      key={panel.id}
                      className="rounded-xl border border-border bg-surface-200/60 p-3"
                    >
                      <p className="text-sm font-semibold text-foreground">{panel.testName}</p>
                      <p className="mt-0.5 text-xs text-foreground-lighter">
                        Standard diagnostic investigation protocol.
                      </p>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-foreground-light">
                        <div>
                          <span className="block text-foreground-lighter">Parameters</span>
                          {panel.parameters.length}
                        </div>
                        <div>
                          <span className="block text-foreground-lighter">Ref. range</span>
                          {panel.parameters[0]?.normalReferenceRange || "—"}
                        </div>
                        <div>
                          <span className="block text-foreground-lighter">Units</span>
                          {panel.parameters[0]?.unitOfMeasurement || "—"}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Samples"
              subtitle={
                detail.samples.length
                  ? `${detail.samples.length} registered`
                  : "No samples yet"
              }
            />
            <div className="px-5 pb-5">
              {detail.status !== "COMPLETED" && detail.status !== "CANCELLED" && (
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <div>
                    <FieldLabel>Specimen type</FieldLabel>
                    <select
                      className={inputClass}
                      value={sampleType}
                      onChange={(e) => setSampleType(e.target.value)}
                      disabled={busy}
                    >
                      {["BLOOD", "URINE", "SWAB", "STOOL", "SPUTUM", "CSF", "OTHER"].map(
                        (t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Notes (optional)</FieldLabel>
                    <input
                      className={inputClass}
                      placeholder="Collection notes…"
                      value={sampleNotes}
                      onChange={(e) => setSampleNotes(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                  <div className="flex items-end">
                    <PrimaryButton disabled={busy} onClick={() => void registerSample()}>
                      {busy ? "Working…" : "Register sample"}
                    </PrimaryButton>
                  </div>
                </div>
              )}
              {detail.samples.length === 0 ? (
                <p className="text-sm text-foreground-lighter">No samples yet.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.samples.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="font-medium text-foreground">{s.sampleId}</span>
                        <span className="text-foreground-lighter">
                          {" "}
                          · {s.sampleType} · {formatWhen(s.collectedAt)}
                        </span>
                      </span>
                      <Badge tone="teal">{s.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/laboratory/samples"
                className="mt-3 inline-flex text-xs font-semibold text-brand-700"
              >
                Open samples board →
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="Investigation findings" subtitle="Data entry → observations → conclusion" />
            <div className="space-y-5 px-5 pb-5">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-lighter">
                  1 · Data entry
                </p>
                {detail.resultEntryParameters.length === 0 ? (
                  <p className="text-sm text-foreground-lighter">No parameters to enter.</p>
                ) : (
                  <div className="space-y-3">
                    {detail.resultEntryParameters.map((p) => (
                      <div key={p.id} className="rounded-xl bg-surface-200 p-3">
                        <p className="text-sm font-medium text-foreground">
                          {p.parameterName}{" "}
                          <span className="text-xs font-normal text-foreground-lighter">
                            ({p.testName} · {p.unitOfMeasurement || "—"} · ref{" "}
                            {p.normalReferenceRange || "—"})
                          </span>
                        </p>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <input
                            className={inputClass}
                            placeholder="Enter quantitative data or detailed results…"
                            value={resultValues[p.id] ?? ""}
                            onChange={(e) =>
                              setResultValues((prev) => ({
                                ...prev,
                                [p.id]: e.target.value,
                              }))
                            }
                            disabled={detail.status === "COMPLETED" || detail.status === "CANCELLED"}
                          />
                          <select
                            className={inputClass}
                            value={interpretations[p.id] ?? "NORMAL"}
                            onChange={(e) =>
                              setInterpretations((prev) => ({
                                ...prev,
                                [p.id]: e.target.value,
                              }))
                            }
                            disabled={detail.status === "COMPLETED" || detail.status === "CANCELLED"}
                          >
                            {["NORMAL", "HIGH", "LOW", "CRITICAL"].map((i) => (
                              <option key={i} value={i}>
                                {i}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {detail.status !== "COMPLETED" && detail.status !== "CANCELLED" && (
                  <div className="mt-3">
                    <PrimaryButton disabled={busy} onClick={() => void saveResults()}>
                      {busy ? "Saving…" : "Save results"}
                    </PrimaryButton>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-lighter">
                  2 · Observations
                </p>
                <textarea
                  className={`${inputClass} min-h-[72px]`}
                  placeholder="Record clinical observations…"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  disabled={detail.status === "CANCELLED"}
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-lighter">
                  3 · Conclusion
                </p>
                <textarea
                  className={`${inputClass} min-h-[72px]`}
                  placeholder="Enter professional conclusion…"
                  value={conclusion}
                  onChange={(e) => setConclusion(e.target.value)}
                  disabled={detail.status === "CANCELLED"}
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-lighter">
                  4 · Evidence upload
                </p>
                <input
                  type="file"
                  className="block w-full text-sm text-foreground-light file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setEvidenceName(f?.name ?? "");
                  }}
                  disabled={detail.status === "CANCELLED"}
                />
                {evidenceName && (
                  <p className="mt-1 text-xs text-foreground-light">Attached: {evidenceName}</p>
                )}
              </div>

              <PrimaryButton disabled={busy || detail.status === "CANCELLED"} onClick={() => void saveFindings()}>
                <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save findings"}
              </PrimaryButton>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Entered results"
              subtitle={`${detail.verifiedCount}/${detail.resultCount} verified`}
              action={
                detail.results.length > 0 ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700"
                    onClick={() => router.push(`/laboratory/results/${detail.id}`)}
                  >
                    <FlaskConical className="h-3.5 w-3.5" /> Open result report
                  </button>
                ) : undefined
              }
            />
            <div className="px-5 pb-5">
              {detail.results.length === 0 ? (
                <p className="text-sm text-foreground-lighter">None yet.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.results.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                    >
                      <span>
                        {r.parameterName}: {r.resultValue}
                        {r.unitOfMeasurement ? ` ${r.unitOfMeasurement}` : ""}{" "}
                        <Badge tone={r.isCritical ? "red" : "slate"}>
                          {r.interpretation}
                        </Badge>
                      </span>
                      {r.isVerified ? (
                        <Badge tone="green">Verified</Badge>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700"
                          onClick={() => void verify(r.id)}
                        >
                          Verify
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {detail.status === "COMPLETED" && (
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
                  {detail.releasedToDoctor ? (
                    <Badge tone="green">
                      Sent to doctor
                      {detail.releasedToDoctorAt
                        ? ` · ${formatWhen(detail.releasedToDoctorAt)}`
                        : ""}
                    </Badge>
                  ) : (
                    <PrimaryButton
                      disabled={busy || !detail.allVerified}
                      onClick={() => void releaseToDoctor()}
                    >
                      <Send className="h-4 w-4" />{" "}
                      {busy ? "Sending…" : "Send to Doctor"}
                    </PrimaryButton>
                  )}
                  <p className="text-xs text-foreground-lighter">
                    Completing verification marks the test done. Send to Doctor
                    makes results available on the consultation Lab Report.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </RoleGuard>
  );
}
