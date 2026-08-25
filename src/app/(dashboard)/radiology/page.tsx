"use client";

import { ChevronDown, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DoctorSearchSelect } from "@/components/doctor-search-select";
import { FieldLabel } from "@/components/field-label";
import { PaginationBar } from "@/components/pagination-bar";
import { PatientSearchSelect } from "@/components/patient-search-select";
import { RoleGuard } from "@/components/role-guard";
import { Avatar, Badge, Card, CardHeader, PageHeader, PrimaryButton, Table, type BadgeTone } from "@/components/ui";
import { api } from "@/lib/api";
import {
  usePaginatedCatalog,
  useScanTypes,
  type CatalogScanRequest,
} from "@/lib/catalog";
import { toPageMeta } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const STATUS_TONES: Record<string, BadgeTone> = {
  Scheduled: "blue",
  "In Progress": "amber",
  "Report Pending": "amber",
  Completed: "green",
  Cancelled: "red",
};

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

export default function RadiologyPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const params = useMemo(
    () => ({
      page,
      limit: 50,
      search: search || undefined,
    }),
    [page, search],
  );
  const { items: scans, total, limit, loading, error, refresh } =
    usePaginatedCatalog<CatalogScanRequest>("/catalog/radiology-queue", params);
  const { data: scanTypes } = useScanTypes();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionId, setActionId] = useState("");
  const [formError, setFormError] = useState("");
  const [patientId, setPatientId] = useState("");
  const [scanTypeId, setScanTypeId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [indication, setIndication] = useState("");
  const [section, setSection] = useState<"requests" | "types" | "report">("requests");
  const [scanTypeRows, setScanTypeRows] = useState<
    Array<{
      id: string;
      scanType: string;
      category: string | null;
      standardPrice: number;
      contrastRequired: boolean;
      isActive: boolean;
    }>
  >([]);
  const [newScanName, setNewScanName] = useState("");
  const [newScanCat, setNewScanCat] = useState("Ultrasound");
  const [newScanPrice, setNewScanPrice] = useState("0");
  const [detailId, setDetailId] = useState("");
  const [detail, setDetail] = useState<{
    id: string;
    requestNumber: string;
    scan: string;
    patientName: string;
    findings: { findings_text?: string | null; status?: string } | null;
    report: {
      final_impression?: string | null;
      conclusion?: string | null;
      recommendations?: string | null;
    } | null;
    images: Array<{ id: string; filePath: string; modality: string | null }>;
  } | null>(null);
  const [findingsText, setFindingsText] = useState("");
  const [impression, setImpression] = useState("");
  const [imagePath, setImagePath] = useState("");

  const submit = async () => {
    if (!patientId || !scanTypeId) {
      setFormError("Select patient and scan type.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api("/ops/radiology-requests", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          scanTypeId,
          requestingDoctorId: doctorId || undefined,
          indication: indication || undefined,
        }),
      });
      setOpen(false);
      setPatientId("");
      setDoctorId("");
      setScanTypeId("");
      setIndication("");
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    setActionId(id);
    try {
      await api(`/radiology/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not update status");
    } finally {
      setActionId("");
    }
  };

  const loadScanTypes = useCallback(async () => {
    try {
      const rows = await api<typeof scanTypeRows>("/imaging/scan-types");
      setScanTypeRows(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not load scan types");
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) {
      setDetail(null);
      return;
    }
    try {
      const d = await api<NonNullable<typeof detail>>(`/imaging/requests/${id}`);
      setDetail(d);
      setFindingsText(d.findings?.findings_text || "");
      setImpression(d.report?.final_impression || "");
      setFormError("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not load request");
    }
  }, []);

  useEffect(() => {
    if (section === "types") void loadScanTypes();
  }, [section, loadScanTypes]);

  useEffect(() => {
    if (section === "report" && detailId) void loadDetail(detailId);
  }, [section, detailId, loadDetail]);

  const openReport = (id: string) => {
    setDetailId(id);
    setSection("report");
  };

  const createScanType = async () => {
    if (!newScanName.trim()) return;
    setBusy(true);
    try {
      await api("/imaging/scan-types", {
        method: "POST",
        body: JSON.stringify({
          scanType: newScanName.trim(),
          category: newScanCat,
          standardPrice: Number(newScanPrice) || 0,
        }),
      });
      setNewScanName("");
      await loadScanTypes();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create scan type");
    } finally {
      setBusy(false);
    }
  };

  const saveFindings = async () => {
    if (!detailId) return;
    setBusy(true);
    try {
      await api(`/imaging/requests/${detailId}/findings`, {
        method: "POST",
        body: JSON.stringify({ findingsText, status: "DRAFT" }),
      });
      await loadDetail(detailId);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save findings");
    } finally {
      setBusy(false);
    }
  };

  const saveReport = async () => {
    if (!detailId) return;
    setBusy(true);
    try {
      await api(`/imaging/requests/${detailId}/report`, {
        method: "POST",
        body: JSON.stringify({ finalImpression: impression }),
      });
      await loadDetail(detailId);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save report");
    } finally {
      setBusy(false);
    }
  };

  const addImage = async () => {
    if (!detailId || !imagePath.trim()) return;
    setBusy(true);
    try {
      await api(`/imaging/requests/${detailId}/images`, {
        method: "POST",
        body: JSON.stringify({ filePath: imagePath.trim(), modality: "CR" }),
      });
      setImagePath("");
      await loadDetail(detailId);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not attach image");
    } finally {
      setBusy(false);
    }
  };

  const meta = toPageMeta({ total, page, limit });
  const accordionBtn = (id: typeof section, label: string) => (
    <button
      type="button"
      onClick={() => setSection(id)}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
        section === id
          ? "bg-brand-50 text-brand-800"
          : "border border-border text-foreground-light hover:border-brand-300"
      }`}
    >
      {label}
      <ChevronDown className={`h-3.5 w-3.5 transition ${section === id ? "rotate-180" : ""}`} />
    </button>
  );

  return (
    <RoleGuard module="radiology">
      <PageHeader
        title="Radiology"
        subtitle={
          loading
            ? "Loading…"
            : `${total.toLocaleString()} imaging requests — scan types, findings, reports, images`
        }
        action={
          <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New scan request
          </PrimaryButton>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {accordionBtn("requests", "Requests")}
        {accordionBtn("types", "Scan types")}
        {accordionBtn("report", "Findings / report / images")}
      </div>
      {section === "requests" && (
      <>
      <div className="mb-4">
        <input
          className={inputClass}
          placeholder="Search patient, scan, doctor…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <Card>
        {error && <p className="px-5 py-3 text-sm text-rose-500">{error}</p>}
        {formError && <p className="px-5 py-3 text-sm text-rose-500">{formError}</p>}
        <Table headers={["Patient", "Scan", "Requested by", "Scheduled", "Status", "Actions"]}>
          {scans.map((r) => {
            const raw = r.rawStatus || "";
            const openScan = ["PENDING", "SCHEDULED", "IN_PROGRESS"].includes(raw);
            return (
              <tr key={r.id} className="transition hover:bg-surface-200/60">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.patient} size="sm" />
                    <span className="font-medium text-foreground">{r.patient}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-foreground-light">{r.scan}</td>
                <td className="px-5 py-3.5 text-foreground-light">{r.requestedBy}</td>
                <td className="px-5 py-3.5 text-foreground-light">{r.scheduled}</td>
                <td className="px-5 py-3.5">
                  <Badge tone={STATUS_TONES[r.status]}>{r.status}</Badge>
                </td>
                <td className="px-5 py-3.5">
                  {openScan ? (
                    <div className="flex flex-wrap gap-1.5">
                      {raw !== "IN_PROGRESS" && (
                        <button
                          type="button"
                          disabled={actionId === r.id}
                          onClick={() => void setStatus(r.id, "IN_PROGRESS")}
                          className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-foreground-light hover:border-amber-300"
                        >
                          Start
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={actionId === r.id}
                        onClick={() => void setStatus(r.id, "COMPLETED")}
                        className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700 hover:bg-brand-100"
                      >
                        Complete
                      </button>
                      <button
                        type="button"
                        disabled={actionId === r.id}
                        onClick={() => void setStatus(r.id, "CANCELLED")}
                        className="rounded-full border border-rose-100 px-2.5 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => openReport(r.id)}
                        className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-foreground-light hover:border-brand-300"
                      >
                        Report
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openReport(r.id)}
                      className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-foreground-light hover:border-brand-300"
                    >
                      Report
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </Card>
      </>
      )}

      {section === "types" && (
        <Card className="mt-5">
          <CardHeader title="Scan types" subtitle="Catalog used when requesting imaging" />
          <div className="grid gap-3 px-5 pb-4 md:grid-cols-3">
            <div>
              <FieldLabel required>Name</FieldLabel>
              <input
                className={inputClass}
                value={newScanName}
                onChange={(e) => setNewScanName(e.target.value)}
                placeholder="Chest X-ray"
              />
            </div>
            <div>
              <FieldLabel>Category</FieldLabel>
              <input
                className={inputClass}
                value={newScanCat}
                onChange={(e) => setNewScanCat(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Price</FieldLabel>
              <input
                className={inputClass}
                value={newScanPrice}
                onChange={(e) => setNewScanPrice(e.target.value)}
              />
            </div>
          </div>
          <div className="px-5 pb-4">
            <PrimaryButton disabled={busy} onClick={() => void createScanType()}>
              Add scan type
            </PrimaryButton>
          </div>
          <Table headers={["Scan", "Category", "Price", "Contrast", "Status"]}>
            {scanTypeRows.map((s) => (
              <tr key={s.id} className="hover:bg-surface-200/60">
                <td className="px-5 py-3.5 font-medium text-foreground">{s.scanType}</td>
                <td className="px-5 py-3.5 text-foreground-light">{s.category || "—"}</td>
                <td className="px-5 py-3.5 text-foreground-light">{s.standardPrice}</td>
                <td className="px-5 py-3.5 text-foreground-light">{s.contrastRequired ? "Yes" : "No"}</td>
                <td className="px-5 py-3.5">
                  <Badge tone={s.isActive ? "green" : "slate"}>
                    {s.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {section === "report" && (
        <Card className="mt-5 p-5">
          <CardHeader
            title={detail ? `${detail.requestNumber} · ${detail.scan}` : "Findings, report & images"}
            subtitle={detail ? detail.patientName : "Open a request from the queue, or pick one below"}
          />
          {!detailId && scans[0] && (
            <button
              type="button"
              className="mb-4 text-sm text-brand-700 hover:underline"
              onClick={() => openReport(scans[0].id)}
            >
              Open latest request
            </button>
          )}
          {detail && (
            <div className="space-y-4">
              <div>
                <FieldLabel>Findings</FieldLabel>
                <textarea
                  className={inputClass}
                  rows={4}
                  value={findingsText}
                  onChange={(e) => setFindingsText(e.target.value)}
                />
                <div className="mt-2">
                  <PrimaryButton disabled={busy} onClick={() => void saveFindings()}>
                    Save findings
                  </PrimaryButton>
                </div>
              </div>
              <div>
                <FieldLabel>Final impression</FieldLabel>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={impression}
                  onChange={(e) => setImpression(e.target.value)}
                />
                <div className="mt-2">
                  <PrimaryButton disabled={busy} onClick={() => void saveReport()}>
                    Save report
                  </PrimaryButton>
                </div>
              </div>
              <div>
                <FieldLabel>Image path / PACS URI</FieldLabel>
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    value={imagePath}
                    onChange={(e) => setImagePath(e.target.value)}
                    placeholder="/pacs/study/…"
                  />
                  <PrimaryButton disabled={busy} onClick={() => void addImage()}>
                    Attach
                  </PrimaryButton>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-foreground-light">
                  {detail.images.map((img) => (
                    <li key={img.id}>
                      {img.modality || "IMG"} · {img.filePath}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Card>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">New scan request</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-foreground-lighter hover:bg-surface-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <FieldLabel required>Patient</FieldLabel>
                <PatientSearchSelect value={patientId} onChange={(id) => setPatientId(id)} />
              </div>
              <div>
                <FieldLabel required>Scan type</FieldLabel>
                <select className={inputClass} value={scanTypeId} onChange={(e) => setScanTypeId(e.target.value)}>
                  <option value="">Select scan</option>
                  {scanTypes.map((s) => (
                    <option key={s.id} value={s.id}>{s.scan_type}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel optional>Requesting doctor</FieldLabel>
                <DoctorSearchSelect value={doctorId} onChange={(id) => setDoctorId(id)} />
              </div>
              <div>
                <FieldLabel optional>Clinical indication</FieldLabel>
                <input
                  className={inputClass}
                  value={indication}
                  onChange={(e) => setIndication(e.target.value)}
                />
              </div>
              {formError && <p className="text-sm text-rose-500">{formError}</p>}
              <PrimaryButton disabled={busy} onClick={submit}>
                {busy ? "Submitting…" : "Create request"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
