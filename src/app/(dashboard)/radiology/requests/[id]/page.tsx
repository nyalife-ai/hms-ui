"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, ImageUp, Trash2, X } from "lucide-react";
import { FieldLabel } from "@/components/field-label";
import { RichTextEditor } from "@/components/rich-text-editor";
import { RoleGuard } from "@/components/role-guard";
import { Badge, Card, CardHeader, PageHeader, PrimaryButton, type BadgeTone } from "@/components/ui";
import { api, downloadFile, uploadFile } from "@/lib/api";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "slate",
  SCHEDULED: "blue",
  CHECKED_IN: "blue",
  IN_PROGRESS: "amber",
  COMPLETED: "amber",
  REPORT_PENDING: "amber",
  REPORTED: "green",
  FINALIZED: "green",
  CANCELLED: "red",
  NO_SHOW: "red",
};

type FindingsRow = {
  id: string;
  findingsText: string | null;
  status: string;
  createdAt: string;
};

type ReportTemplate = {
  id: string;
  name: string;
  sections: Array<{ key: string; label: string; type: string; required?: boolean }>;
};

type ReportRow = {
  id: string;
  findingsId: string;
  finalImpression: string | null;
  conclusion: string | null;
  recommendations: string | null;
  version: number;
  status: string;
  signedAt: string | null;
  finalizedAt: string | null;
  amendsReportId: string | null;
  amendmentReason: string | null;
  createdAt: string;
};

type ImageRow = {
  id: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  modality: string | null;
  seriesDescription: string | null;
  numberOfImages: number | null;
  createdAt: string;
};

type RequestDetail = {
  id: string;
  requestNumber: string;
  patientName: string;
  mrn: string;
  scan: string;
  modality: string | null;
  contrastRequired: boolean;
  preparationInstructions: string | null;
  requestedBy: string;
  indication: string | null;
  priority: string;
  status: string;
  scheduledAt: string | null;
  checkedInAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  reportedAt: string | null;
  finalizedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  findingsHistory: FindingsRow[];
  reportsHistory: ReportRow[];
  images: ImageRow[];
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function RadiologyRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setDetail(await api<RequestDetail>(`/imaging/requests/${id}`));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load request");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  // Schedule modal
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  // Cancel modal
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Findings/report drafts
  const [findingsText, setFindingsText] = useState("");
  const [finalImpression, setFinalImpression] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [sectionsData, setSectionsData] = useState<Record<string, string>>({});

  useEffect(() => {
    api<ReportTemplate[]>("/imaging/report-templates?active=true")
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  // Amend modal
  const [showAmend, setShowAmend] = useState(false);
  const [amendReportId, setAmendReportId] = useState("");
  const [amendImpression, setAmendImpression] = useState("");
  const [amendReason, setAmendReason] = useState("");

  if (loading && !detail) {
    return (
      <RoleGuard module="radiology">
        <Card className="p-8 text-center text-sm text-foreground-lighter">Loading…</Card>
      </RoleGuard>
    );
  }
  if (!detail) {
    return (
      <RoleGuard module="radiology">
        <Card className="p-8 text-center text-sm text-rose-500">{error || "Request not found"}</Card>
      </RoleGuard>
    );
  }

  const latestReport = detail.reportsHistory[0];
  const activeTemplate = templates.find((t) => t.id === templateId);
  const canSchedule = ["PENDING", "SCHEDULED"].includes(detail.status);
  const canCheckIn = ["PENDING", "SCHEDULED"].includes(detail.status);
  const canStart = ["PENDING", "SCHEDULED", "CHECKED_IN"].includes(detail.status);
  const canComplete = detail.status === "IN_PROGRESS";
  const canCancel = !["FINALIZED", "CANCELLED", "NO_SHOW"].includes(detail.status);
  const canNoShow = ["PENDING", "SCHEDULED"].includes(detail.status);
  const canEnterFindings = ["COMPLETED", "REPORT_PENDING"].includes(detail.status);
  const canEnterReport = detail.status === "REPORT_PENDING";
  const canFinalize = detail.status === "REPORTED";
  const canAmend = detail.status === "FINALIZED";
  const canDownloadReport = detail.reportsHistory.some(
    (r) => r.status === "FINAL" || r.status === "AMENDED",
  );

  const onDownloadReport = async () => {
    setDownloadBusy(true);
    setError("");
    try {
      await downloadFile(
        `/imaging/requests/${id}/report/docx`,
        `radiology-report-${detail.requestNumber}.docx`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadBusy(false);
    }
  };

  const onUploadImage = async (file: File | null) => {
    if (!file) return;
    setUploadBusy(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      await uploadFile(`/imaging/requests/${id}/images`, formData);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onDownloadImage = async (image: ImageRow) => {
    try {
      await downloadFile(
        `/imaging/images/${image.id}/content`,
        image.fileName || `radiology-image-${image.id}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  };

  const onDeleteImage = async (image: ImageRow) => {
    if (!window.confirm(`Delete "${image.fileName || "this file"}"? This cannot be undone.`)) {
      return;
    }
    setError("");
    try {
      await api(`/imaging/images/${image.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const formatBytes = (bytes: number | null): string => {
    if (bytes == null) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <RoleGuard module="radiology">
      <button
        type="button"
        onClick={() => router.push("/radiology/requests")}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-foreground-light hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to requests
      </button>
      <PageHeader
        title={detail.requestNumber}
        subtitle={`${detail.patientName} · MRN ${detail.mrn} · ${detail.scan}`}
        action={<Badge tone={STATUS_TONE[detail.status] ?? "slate"}>{detail.status.replaceAll("_", " ")}</Badge>}
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Request details" />
            <div className="space-y-2 px-5 pb-5 text-sm">
              <p><span className="text-foreground-lighter">Priority:</span> {detail.priority}</p>
              <p><span className="text-foreground-lighter">Requested by:</span> {detail.requestedBy}</p>
              {detail.indication && (
                <p><span className="text-foreground-lighter">Indication:</span> {detail.indication}</p>
              )}
              {detail.contrastRequired && (
                <p className="text-amber-600">Contrast required</p>
              )}
              {detail.preparationInstructions && (
                <p><span className="text-foreground-lighter">Prep:</span> {detail.preparationInstructions}</p>
              )}
              <div className="pt-2 text-xs text-foreground-lighter">
                <p>Scheduled: {fmt(detail.scheduledAt)}</p>
                <p>Checked in: {fmt(detail.checkedInAt)}</p>
                <p>Started: {fmt(detail.startedAt)}</p>
                <p>Completed: {fmt(detail.completedAt)}</p>
                <p>Reported: {fmt(detail.reportedAt)}</p>
                <p>Finalized: {fmt(detail.finalizedAt)}</p>
                {detail.cancelledAt && (
                  <p>Cancelled: {fmt(detail.cancelledAt)} {detail.cancellationReason ? `(${detail.cancellationReason})` : ""}</p>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Actions" />
            <div className="flex flex-wrap gap-2 px-5 pb-5">
              {canSchedule && (
                <button disabled={busy} onClick={() => setShowSchedule(true)} className="rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-foreground hover:border-brand-300">
                  Schedule
                </button>
              )}
              {canCheckIn && (
                <button disabled={busy} onClick={() => void run(() => api(`/imaging/requests/${id}/check-in`, { method: "POST" }))} className="rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-foreground hover:border-brand-300">
                  Check in
                </button>
              )}
              {canStart && (
                <button disabled={busy} onClick={() => void run(() => api(`/imaging/requests/${id}/start`, { method: "POST" }))} className="rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-foreground hover:border-brand-300">
                  Start exam
                </button>
              )}
              {canComplete && (
                <button disabled={busy} onClick={() => void run(() => api(`/imaging/requests/${id}/complete`, { method: "POST" }))} className="rounded-full bg-brand-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">
                  Complete exam
                </button>
              )}
              {canNoShow && (
                <button disabled={busy} onClick={() => void run(() => api(`/imaging/requests/${id}/no-show`, { method: "POST" }))} className="rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-foreground hover:border-brand-300">
                  No-show
                </button>
              )}
              {canFinalize && (
                <button disabled={busy} onClick={() => void run(() => api(`/imaging/requests/${id}/finalize`, { method: "POST" }))} className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                  Finalize &amp; release
                </button>
              )}
              {canDownloadReport && (
                <button disabled={downloadBusy} onClick={() => void onDownloadReport()} className="rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-foreground hover:border-brand-300 disabled:opacity-50">
                  {downloadBusy ? "Preparing…" : "Download DOCX"}
                </button>
              )}
              {canCancel && (
                <button disabled={busy} onClick={() => setShowCancel(true)} className="rounded-full border border-rose-200 px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                  Cancel
                </button>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {canEnterFindings && (
            <Card>
              <CardHeader title="Findings" subtitle="Procedure and findings" />
              <div className="space-y-3 px-5 pb-5">
                <RichTextEditor
                  value={findingsText}
                  onChange={setFindingsText}
                  placeholder="Describe the procedure and findings…"
                />
                <div className="flex justify-end gap-2">
                  <button
                    disabled={busy || !findingsText.trim()}
                    onClick={() =>
                      void run(() =>
                        api(`/imaging/requests/${id}/findings`, {
                          method: "POST",
                          body: JSON.stringify({ findingsText, status: "DRAFT" }),
                        }),
                      ).then(() => setFindingsText(""))
                    }
                    className="rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-foreground hover:border-brand-300 disabled:opacity-50"
                  >
                    Save draft
                  </button>
                </div>
              </div>
            </Card>
          )}

          {canEnterReport && (
            <Card>
              <CardHeader title="Report" subtitle="Impression / conclusion" />
              <div className="space-y-3 px-5 pb-5">
                <div>
                  <FieldLabel optional>Report template</FieldLabel>
                  <select
                    className={inputClass}
                    value={templateId}
                    onChange={(e) => {
                      setTemplateId(e.target.value);
                      setSectionsData({});
                    }}
                  >
                    <option value="">No template — narrative only</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                {activeTemplate && activeTemplate.sections.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-border bg-surface-200 p-3">
                    <p className="text-xs font-semibold text-foreground-light">Measurements</p>
                    <div className="grid grid-cols-2 gap-2">
                      {activeTemplate.sections.map((s) => (
                        <div key={s.key}>
                          <FieldLabel optional={!s.required}>{s.label}</FieldLabel>
                          <input
                            type={s.type === "date" ? "date" : s.type === "number" ? "number" : "text"}
                            className={inputClass}
                            value={sectionsData[s.key] ?? ""}
                            onChange={(e) =>
                              setSectionsData((prev) => ({ ...prev, [s.key]: e.target.value }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <FieldLabel optional>Final impression</FieldLabel>
                  <RichTextEditor
                    value={finalImpression}
                    onChange={setFinalImpression}
                    placeholder="Final impression…"
                  />
                </div>
                <div>
                  <FieldLabel optional>Conclusion</FieldLabel>
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={conclusion}
                    onChange={(e) => setConclusion(e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel optional>Recommendations</FieldLabel>
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={recommendations}
                    onChange={(e) => setRecommendations(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        api(`/imaging/requests/${id}/report`, {
                          method: "POST",
                          body: JSON.stringify({
                            finalImpression,
                            conclusion,
                            recommendations,
                            templateId: templateId || undefined,
                            sectionsData: Object.keys(sectionsData).length ? sectionsData : undefined,
                            finalize: false,
                          }),
                        }),
                      )
                    }
                    className="rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-foreground hover:border-brand-300 disabled:opacity-50"
                  >
                    Save draft
                  </button>
                  <PrimaryButton
                    disabled={busy || !finalImpression.trim()}
                    onClick={() =>
                      void run(() =>
                        api(`/imaging/requests/${id}/report`, {
                          method: "POST",
                          body: JSON.stringify({
                            finalImpression,
                            conclusion,
                            recommendations,
                            templateId: templateId || undefined,
                            sectionsData: Object.keys(sectionsData).length ? sectionsData : undefined,
                            finalize: true,
                          }),
                        }),
                      )
                    }
                  >
                    Finalize report
                  </PrimaryButton>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Report history"
              action={
                canAmend && latestReport ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAmendReportId(latestReport.id);
                      setAmendImpression(latestReport.finalImpression ?? "");
                      setShowAmend(true);
                    }}
                    className="text-xs font-medium text-brand-700 hover:underline"
                  >
                    Amend latest report
                  </button>
                ) : undefined
              }
            />
            <div className="space-y-3 px-5 pb-5">
              {detail.reportsHistory.length === 0 && (
                <p className="text-sm text-foreground-lighter">No reports yet.</p>
              )}
              {detail.reportsHistory.map((r) => (
                <div key={r.id} className="rounded-xl border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <Badge tone={r.status === "FINAL" || r.status === "AMENDED" ? "green" : "slate"}>
                      {r.status} · v{r.version}
                    </Badge>
                    <span className="text-xs text-foreground-lighter">{fmt(r.createdAt)}</span>
                  </div>
                  {r.finalImpression && (
                    <div
                      className="prose prose-sm mt-2 max-w-none text-foreground-light"
                      dangerouslySetInnerHTML={{ __html: r.finalImpression }}
                    />
                  )}
                  {r.conclusion && <p className="mt-1 text-xs text-foreground-lighter">{r.conclusion}</p>}
                  {r.amendmentReason && (
                    <p className="mt-1 text-xs italic text-amber-700">Amendment reason: {r.amendmentReason}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Images & attachments"
              subtitle="Scanned requisitions, exported images, or reference files"
              action={
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => void onUploadImage(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    disabled={uploadBusy}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-brand-300 disabled:opacity-50"
                  >
                    <ImageUp className="h-3.5 w-3.5" />
                    {uploadBusy ? "Uploading…" : "Upload"}
                  </button>
                </>
              }
            />
            <div className="space-y-2 px-5 pb-5">
              {detail.images.length === 0 && (
                <p className="text-sm text-foreground-lighter">No images uploaded yet.</p>
              )}
              {detail.images.map((img) => (
                <div
                  key={img.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {img.fileName || "Untitled file"}
                    </p>
                    <p className="text-xs text-foreground-lighter">
                      {[img.modality, img.seriesDescription, formatBytes(img.fileSize), fmt(img.createdAt)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void onDownloadImage(img)}
                      className="rounded-full border border-border p-2 text-foreground-light hover:border-brand-300 hover:text-brand-700"
                      aria-label="Download"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteImage(img)}
                      className="rounded-full border border-border p-2 text-foreground-light hover:border-rose-300 hover:text-rose-600"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {showSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-2xl bg-surface p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Schedule exam</h2>
              <button type="button" onClick={() => setShowSchedule(false)}><X className="h-4 w-4 text-foreground-lighter" /></button>
            </div>
            <div>
              <FieldLabel required>Date &amp; time</FieldLabel>
              <input
                type="datetime-local"
                className={inputClass}
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowSchedule(false)} className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground-light hover:border-brand-300">
                Cancel
              </button>
              <PrimaryButton
                disabled={!scheduledAt || busy}
                onClick={() =>
                  void run(() =>
                    api(`/imaging/requests/${id}/schedule`, {
                      method: "POST",
                      body: JSON.stringify({ scheduledAt: new Date(scheduledAt).toISOString() }),
                    }),
                  ).then(() => setShowSchedule(false))
                }
              >
                Schedule
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-2xl bg-surface p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Cancel request</h2>
              <button type="button" onClick={() => setShowCancel(false)}><X className="h-4 w-4 text-foreground-lighter" /></button>
            </div>
            <div>
              <FieldLabel optional>Reason</FieldLabel>
              <input className={inputClass} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowCancel(false)} className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground-light hover:border-brand-300">
                Back
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    api(`/imaging/requests/${id}/cancel`, {
                      method: "POST",
                      body: JSON.stringify({ reason: cancelReason.trim() || undefined }),
                    }),
                  ).then(() => setShowCancel(false))
                }
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Confirm cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showAmend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-lg space-y-3 rounded-2xl bg-surface p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Amend finalized report</h2>
              <button type="button" onClick={() => setShowAmend(false)}><X className="h-4 w-4 text-foreground-lighter" /></button>
            </div>
            <p className="text-xs text-foreground-lighter">
              The original report is preserved. This creates a new, separately-tracked amended version.
            </p>
            <div>
              <FieldLabel required>Revised final impression</FieldLabel>
              <RichTextEditor value={amendImpression} onChange={setAmendImpression} />
            </div>
            <div>
              <FieldLabel required>Reason for amendment</FieldLabel>
              <textarea className={inputClass} rows={2} value={amendReason} onChange={(e) => setAmendReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowAmend(false)} className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground-light hover:border-brand-300">
                Cancel
              </button>
              <PrimaryButton
                disabled={busy || !amendReason.trim()}
                onClick={() =>
                  void run(() =>
                    api(`/imaging/requests/${id}/report/amend`, {
                      method: "POST",
                      body: JSON.stringify({
                        reportId: amendReportId,
                        finalImpression: amendImpression,
                        reason: amendReason,
                      }),
                    }),
                  ).then(() => {
                    setShowAmend(false);
                    setAmendReason("");
                  })
                }
              >
                Submit amendment
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
