"use client";

import Link from "next/link";
import { Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { DoctorSearchSelect } from "@/components/doctor-search-select";
import { FieldLabel } from "@/components/field-label";
import { PaginationBar } from "@/components/pagination-bar";
import { PatientSearchSelect } from "@/components/patient-search-select";
import { RoleGuard } from "@/components/role-guard";
import { Badge, Card, PageHeader, PrimaryButton, Table, type BadgeTone } from "@/components/ui";
import { api } from "@/lib/api";
import { useScanTypes } from "@/lib/catalog";
import { usePaginatedCatalog } from "@/lib/catalog";
import { toPageMeta } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

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

const PRIORITY_TONE: Record<string, BadgeTone> = {
  ROUTINE: "slate",
  URGENT: "amber",
  STAT: "red",
};

const STATUSES = [
  "PENDING",
  "SCHEDULED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
  "REPORT_PENDING",
  "REPORTED",
  "FINALIZED",
  "CANCELLED",
  "NO_SHOW",
];

type RequestRow = {
  id: string;
  requestNumber: string;
  patientName: string;
  mrn: string;
  scan: string;
  requestedBy: string;
  priority: string;
  status: string;
  createdAt: string;
};

export default function RadiologyRequestsPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const [status, setStatus] = useState("");

  const params = useMemo(
    () => ({ page, limit: 20, search: search || undefined, status: status || undefined }),
    [page, search, status],
  );
  const { items: requests, total, limit, loading, error, refresh } =
    usePaginatedCatalog<RequestRow>("/imaging/requests", params);
  const meta = toPageMeta({ total, page, limit });

  const { data: scanTypes } = useScanTypes();

  const [showModal, setShowModal] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [scanTypeId, setScanTypeId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [indication, setIndication] = useState("");
  const [priority, setPriority] = useState("ROUTINE");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const resetForm = () => {
    setPatientId("");
    setScanTypeId("");
    setDoctorId("");
    setIndication("");
    setPriority("ROUTINE");
    setFormError("");
  };

  const submitRequest = async () => {
    if (!patientId || !scanTypeId) {
      setFormError("Patient and scan type are required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await api("/imaging/requests", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          scanTypeId,
          requestingDoctorId: doctorId || undefined,
          clinicalIndication: indication.trim() || undefined,
          priority,
        }),
      });
      setShowModal(false);
      resetForm();
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create request");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard module="radiology">
      <PageHeader
        title="Imaging requests"
        subtitle={loading ? "Loading requests…" : `${total.toLocaleString()} requests`}
        action={
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" />
            New request
          </button>
        }
      />

      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-lighter" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            placeholder="Search by request # or MRN"
            className="w-full rounded-full border border-border bg-surface py-2.5 pl-11 pr-4 text-sm text-foreground placeholder:text-foreground-lighter focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-foreground"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <Table
          headers={["Request #", "Patient", "Scan", "Requested by", "Priority", "Status", ""]}
        >
          {requests.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 font-medium text-foreground">{r.requestNumber}</td>
              <td className="px-4 py-3 text-foreground-light">
                {r.patientName}
                <span className="block text-xs text-foreground-lighter">MRN {r.mrn}</span>
              </td>
              <td className="px-4 py-3 text-foreground-light">{r.scan}</td>
              <td className="px-4 py-3 text-foreground-light">{r.requestedBy}</td>
              <td className="px-4 py-3">
                <Badge tone={PRIORITY_TONE[r.priority] ?? "slate"}>{r.priority}</Badge>
              </td>
              <td className="px-4 py-3">
                <Badge tone={STATUS_TONE[r.status] ?? "slate"}>
                  {r.status.replaceAll("_", " ")}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/radiology/requests/${r.id}`}
                  className="text-xs font-medium text-brand-700 hover:underline"
                >
                  Open
                </Link>
              </td>
            </tr>
          ))}
          {!loading && requests.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-sm text-foreground-lighter">
                No imaging requests found.
              </td>
            </tr>
          )}
        </Table>
      </Card>
      <div className="mt-4 rounded-2xl border border-border bg-surface">
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-lg space-y-3 rounded-2xl bg-surface p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">New imaging request</h2>
              <button type="button" onClick={() => setShowModal(false)}>
                <X className="h-4 w-4 text-foreground-lighter" />
              </button>
            </div>
            <div>
              <FieldLabel required>Patient</FieldLabel>
              <PatientSearchSelect value={patientId} onChange={(id) => setPatientId(id)} />
            </div>
            <div>
              <FieldLabel required>Scan type</FieldLabel>
              <select
                className={inputClass}
                value={scanTypeId}
                onChange={(e) => setScanTypeId(e.target.value)}
              >
                <option value="">Select scan type</option>
                {scanTypes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.scan_type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel optional>Requesting doctor</FieldLabel>
              <DoctorSearchSelect value={doctorId} onChange={(id) => setDoctorId(id)} />
            </div>
            <div>
              <FieldLabel optional>Clinical indication</FieldLabel>
              <textarea
                className={inputClass}
                rows={2}
                value={indication}
                onChange={(e) => setIndication(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel optional>Priority</FieldLabel>
              <select
                className={inputClass}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="ROUTINE">Routine</option>
                <option value="URGENT">Urgent</option>
                <option value="STAT">STAT</option>
              </select>
            </div>
            {formError && <p className="text-sm text-rose-600">{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground-light hover:border-brand-300"
              >
                Cancel
              </button>
              <PrimaryButton onClick={() => void submitRequest()} disabled={saving}>
                {saving ? "Creating…" : "Create request"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
