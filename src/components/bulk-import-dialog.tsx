"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { PrimaryButton } from "@/components/ui";
import {
  commitBulkImport,
  downloadBulkImportErrors,
  downloadBulkImportFile,
  validateBulkImport,
  type BulkImportCommitResult,
  type BulkImportPreview,
} from "@/lib/bulk-import";

type Step = "upload" | "preview" | "done";

export function BulkImportDialog({
  resource,
  title,
  description,
  onClose,
  onImported,
}: {
  resource: string;
  title: string;
  description: string;
  onClose: () => void;
  onImported?: () => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<BulkImportPreview | null>(null);
  const [result, setResult] = useState<BulkImportCommitResult | null>(null);

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setError("");
    setFileName(file.name);
    setBusy(true);
    try {
      const data = await validateBulkImport(resource, file);
      setPreview(data);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not validate the file.");
      setPreview(null);
      setStep("upload");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onConfirm = async () => {
    if (!preview?.canCommit) return;
    setBusy(true);
    setError("");
    try {
      const data = await commitBulkImport(resource, preview.sessionId);
      setResult(data);
      setStep("done");
      await onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-import-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-100"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2
              id="bulk-import-title"
              className="text-base font-semibold text-foreground"
            >
              {title}
            </h2>
            <p className="mt-0.5 text-sm text-foreground-light">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-foreground-lighter hover:bg-surface-200 hover:text-foreground-light"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p
              className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700"
              role="alert"
            >
              {error}
            </p>
          )}

          {step === "upload" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void downloadBulkImportFile(resource, "template").catch(
                      (err) =>
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Could not download template",
                        ),
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3.5 py-2 text-sm font-medium text-foreground hover:bg-brand-50"
                >
                  <Download className="h-4 w-4" />
                  Download template
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void downloadBulkImportFile(resource, "example").catch(
                      (err) =>
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Could not download example",
                        ),
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3.5 py-2 text-sm font-medium text-foreground hover:bg-brand-50"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Download example
                </button>
              </div>

              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface-200/80 px-4 py-10 text-center transition hover:border-brand-400 hover:bg-brand-50/40">
                <Upload className="h-8 w-8 text-brand-600" />
                <span className="text-sm font-medium text-foreground">
                  {busy ? "Checking file…" : "Choose a CSV file"}
                </span>
                <span className="text-xs text-foreground-light">
                  Prepare your file from the template, then upload to review before importing.
                </span>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          )}

          {step === "preview" && preview && (
            <div className="space-y-4">
              <p className="text-sm text-foreground-light">
                File: <span className="font-medium text-foreground">{fileName}</span>
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Total rows" value={preview.totalRows} />
                <Stat label="Ready" value={preview.validRows} tone="ok" />
                <Stat label="Need attention" value={preview.invalidRows} tone="bad" />
                <Stat label="Warnings" value={preview.warningRows} tone="warn" />
              </div>

              {!preview.canCommit && (
                <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Partial import is not allowed. Fix every row that needs attention, then upload the corrected file. Nothing has been imported yet.
                </p>
              )}

              {preview.canCommit && preview.warningRows > 0 && (
                <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Some rows have warnings (for example possible duplicate phone numbers). You can still import if you have reviewed them.
                </p>
              )}

              {(preview.errors.length > 0 || preview.warnings.length > 0) && (
                <div className="overflow-hidden rounded-xl ring-1 ring-slate-100">
                  <div className="flex items-center justify-between bg-surface-200 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground-light">
                      Review details
                    </p>
                    <button
                      type="button"
                      className="text-xs font-medium text-brand-700 hover:underline"
                      onClick={() =>
                        void downloadBulkImportErrors(
                          resource,
                          preview.sessionId,
                        ).catch((err) =>
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Could not download report",
                          ),
                        )
                      }
                    >
                      Download report
                    </button>
                  </div>
                  <ul className="max-h-48 divide-y divide-border overflow-y-auto text-sm">
                    {[...preview.errors, ...preview.warnings]
                      .slice(0, 40)
                      .map((issue, i) => (
                        <li key={`${issue.row}-${i}`} className="px-3 py-2">
                          <span className="font-medium text-foreground">
                            Row {issue.row}
                          </span>
                          <span className="text-foreground-light">
                            {issue.field ? ` · ${issue.field}` : ""}
                          </span>
                          <p className="text-foreground-light">{issue.message}</p>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {preview.previewSample.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-light">
                    Sample of records ready to import
                  </p>
                  <ul className="space-y-1 text-sm text-foreground">
                    {preview.previewSample.map((row, i) => (
                      <li
                        key={i}
                        className="rounded-lg bg-surface-200 px-3 py-2"
                      >
                        {[row.firstName, row.lastName].filter(Boolean).join(" ")}
                        {row.phone ? ` · ${row.phone}` : ""}
                        {row.email ? ` · ${row.email}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === "done" && result && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl bg-brand-50 px-4 py-3 text-brand-900">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Import completed</p>
                  <p className="mt-1 text-sm">
                    Imported successfully: {result.imported}
                    {result.failed > 0 ? ` · Failed: ${result.failed}` : ""}
                    {result.skipped > 0 ? ` · Skipped: ${result.skipped}` : ""}
                  </p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-rose-700">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4">
          {step === "upload" && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-medium text-foreground-light hover:bg-surface-200"
            >
              Cancel
            </button>
          )}
          {step === "preview" && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setStep("upload");
                  setPreview(null);
                  setError("");
                }}
                className="rounded-full px-4 py-2 text-sm font-medium text-foreground-light hover:bg-surface-200"
              >
                Upload again
              </button>
              <PrimaryButton
                disabled={busy || !preview?.canCommit}
                onClick={() => void onConfirm()}
              >
                {busy ? "Importing…" : "Import records"}
              </PrimaryButton>
            </>
          )}
          {step === "done" && (
            <PrimaryButton onClick={onClose}>Done</PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "bad" | "warn";
}) {
  const color =
    tone === "ok"
      ? "text-emerald-700"
      : tone === "bad"
        ? "text-rose-700"
        : tone === "warn"
          ? "text-amber-800"
          : "text-foreground";
  return (
    <div className="rounded-xl bg-surface-200 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-lighter">
        {label}
      </p>
      <p className={`mt-0.5 text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}
