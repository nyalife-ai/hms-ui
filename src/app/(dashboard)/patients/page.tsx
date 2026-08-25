"use client";

import {
  Pencil,
  Plus,
  Upload,
  UserRound,
  Users,
  UserRoundPlus,
  Venus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BulkImportDialog } from "@/components/bulk-import-dialog";
import { EmptyState } from "@/components/empty-state";
import { Modal } from "@/components/modal";
import { PaginationBar } from "@/components/pagination-bar";
import {
  EMPTY_PATIENT_FORM,
  PatientForm,
  toOpsCreateBody,
  toPatientsUpdateBody,
  validatePatientForm,
  type PatientFormValues,
} from "@/components/patient-form";
import { PatientQuickViewModal } from "@/components/patient-quick-view-modal";
import { PatientRowActions } from "@/components/patient-row-actions";
import { RecordVitalsModal } from "@/components/record-vitals-modal";
import { RoleGuard } from "@/components/role-guard";
import { TableAction } from "@/components/table-action";
import {
  Avatar,
  Badge,
  Card,
  PrimaryButton,
  StatCard,
  Table,
} from "@/components/ui";
import { PageLayout, ScaffoldContainer } from "@/components/studio";
import { api } from "@/lib/api";
import {
  usePaginatedCatalog,
  usePatientSummary,
  type CatalogPatient,
  type PatientDetail,
} from "@/lib/catalog";
import { toPageMeta } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useAuth } from "@/lib/auth";

function genderFromDetail(g: string): PatientFormValues["gender"] {
  const u = g.toUpperCase();
  if (u === "MALE" || g === "Male") return "Male";
  if (u === "OTHER" || g === "Other") return "Other";
  return "Female";
}

function detailToForm(d: PatientDetail): PatientFormValues {
  return {
    ...EMPTY_PATIENT_FORM,
    firstName: d.firstName || d.name.trim().split(/\s+/)[0] || "",
    lastName:
      d.lastName ||
      d.name.trim().split(/\s+/).slice(1).join(" ") ||
      "",
    email: d.email || "",
    phone: d.phone || "",
    gender: genderFromDetail(d.gender || ""),
    dateOfBirth: d.dateOfBirth?.slice(0, 10) || "",
    address: d.address || "",
    city: d.city || "",
    country: d.country || "",
    postalCode: d.postalCode || "",
    bloodGroup: d.bloodGroup || "",
    occupation: d.occupation || "",
    maritalStatus: d.maritalStatus || "",
    allergies: d.allergies || "",
    chronicDiseases: d.chronicDiseases || "",
    emergencyContactName: d.emergencyContact?.name || "",
    emergencyContactPhone: d.emergencyContact?.phone || "",
  };
}

export default function PatientsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canImport =
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN" ||
    user?.role === "RECEPTIONIST";
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [gender, setGender] = useState("");
  const [status, setStatus] = useState("");
  const search = useDebouncedValue(searchInput, 400);

  const params = useMemo(
    () => ({
      page,
      limit: 50,
      search: search || undefined,
      gender: gender || undefined,
      status: status || undefined,
    }),
    [page, search, gender, status],
  );

  const { items, total, limit, loading, error, refresh } =
    usePaginatedCatalog<CatalogPatient>("/catalog/patients", params);
  const {
    data: summary,
    loading: summaryLoading,
    refresh: refreshSummary,
  } = usePatientSummary();

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<PatientFormValues>(EMPTY_PATIENT_FORM);
  const [editInsurance, setEditInsurance] = useState<
    PatientDetail["insurance"]
  >([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [vitalsPatient, setVitalsPatient] = useState<CatalogPatient | null>(
    null,
  );

  const openCreate = () => {
    setForm(EMPTY_PATIENT_FORM);
    setFormError("");
    setCreateOpen(true);
  };

  const openEdit = async (p: CatalogPatient) => {
    setEditId(p.id);
    setFormError("");
    setBusy(true);
    try {
      const d = await api<PatientDetail>(`/catalog/patients/${p.id}`);
      setForm(detailToForm(d));
      setEditInsurance(d.insurance ?? []);
    } catch {
      const parts = p.name.trim().split(/\s+/);
      setForm({
        ...EMPTY_PATIENT_FORM,
        firstName: parts[0] || "",
        lastName: parts.slice(1).join(" ") || "",
        phone: p.phone || "",
        gender: genderFromDetail(p.gender),
      });
      setEditInsurance([]);
    } finally {
      setBusy(false);
    }
  };

  const submitCreate = async () => {
    const err = validatePatientForm(form);
    if (err) {
      setFormError(err);
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api("/ops/patients", {
        method: "POST",
        body: JSON.stringify(toOpsCreateBody(form)),
      });
      setCreateOpen(false);
      setForm(EMPTY_PATIENT_FORM);
      await Promise.all([refresh(), refreshSummary()]);
    } catch (e) {
      setFormError(
        e instanceof Error
          ? e.message
          : "Unable to register the patient. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async () => {
    if (!editId) return;
    const err = validatePatientForm(form, { requirePhone: false });
    if (err) {
      setFormError(err);
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api(`/patients/${editId}`, {
        method: "PATCH",
        body: JSON.stringify(toPatientsUpdateBody(form)),
      });
      setEditId(null);
      await refresh();
    } catch (e) {
      setFormError(
        e instanceof Error
          ? e.message
          : "Unable to save changes. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const meta = toPageMeta({ total, page, limit });
  const kpi = summary ?? { total: 0, female: 0, male: 0, recent7d: 0 };
  const inputClass =
    "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

  return (
    <RoleGuard module="patients">
      <PageLayout
        title="Patients"
        subtitle={
          loading ? "Loading patients…" : `${total.toLocaleString()} in the registry`
        }
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Patients" },
          { label: "Patients Registry" },
        ]}
        primaryActions={
          <div className="flex flex-wrap items-center gap-2">
            {canImport && (
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-brand-50 hover:text-brand-700"
              >
                <Upload className="h-4 w-4" />
                Import patients
              </button>
            )}
            <PrimaryButton onClick={openCreate}>
              <Plus className="h-4 w-4" /> Register patient
            </PrimaryButton>
          </div>
        }
      >
        <ScaffoldContainer className="pt-6">
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Patients"
          value={summaryLoading ? "…" : String(kpi.total)}
          deltaLabel="registered in the clinic"
          icon={Users}
        />
        <StatCard
          label="Female"
          value={summaryLoading ? "…" : String(kpi.female)}
          deltaLabel="biological gender"
          icon={Venus}
        />
        <StatCard
          label="Male"
          value={summaryLoading ? "…" : String(kpi.male)}
          deltaLabel="biological gender"
          icon={UserRound}
        />
        <StatCard
          label="Recent (7d)"
          value={summaryLoading ? "…" : String(kpi.recent7d)}
          deltaLabel="newly registered"
          icon={UserRoundPlus}
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3">
        <input
          className={inputClass}
          placeholder="Search name, phone, MRN, email…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={inputClass}
          value={gender}
          onChange={(e) => {
            setGender(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All genders</option>
          <option value="Female">Female</option>
          <option value="Male">Male</option>
          <option value="Other">Other</option>
        </select>
        <select
          className={inputClass}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="ADMITTED">Admitted</option>
        </select>
      </div>

      <Card>
        {error && <p className="px-4 py-3 text-sm text-rose-500">{error}</p>}
        <Table
          headers={[
            "Patient",
            "MRN",
            "Age",
            "Gender",
            "Phone",
            "Last visit",
            "Status",
            "Actions",
          ]}
        >
          {!loading &&
            items.map((p) => (
              <tr key={p.id} className="transition hover:bg-surface-200/60">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} size="sm" />
                    <button
                      type="button"
                      onClick={() => setQuickViewId(p.id)}
                      className="cursor-pointer text-left font-medium text-foreground underline-offset-2 hover:text-brand-700 hover:underline"
                    >
                      {p.name}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-foreground-light">{p.mrn}</td>
                <td className="px-4 py-2.5 text-foreground-light">{p.age || "—"}</td>
                <td className="px-4 py-2.5 text-foreground-light">{p.gender}</td>
                <td className="px-4 py-2.5 text-foreground-light">{p.phone}</td>
                <td className="px-4 py-2.5 text-foreground-light">{p.lastVisit}</td>
                <td className="px-4 py-2.5">
                  <Badge
                    tone={
                      p.status === "Admitted"
                        ? "amber"
                        : p.status === "Active"
                          ? "green"
                          : "slate"
                    }
                  >
                    {p.status}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-0.5">
                    <TableAction
                      icon={Pencil}
                      label="Edit patient"
                      tone="edit"
                      onClick={() => void openEdit(p)}
                    />
                    <PatientRowActions
                      onRecordVital={() => setVitalsPatient(p)}
                      onQuickView={() => setQuickViewId(p.id)}
                      onFullProfile={() => router.push(`/patients/${p.id}`)}
                    />
                  </div>
                </td>
              </tr>
            ))}
        </Table>
        {loading && (
          <div className="space-y-2 px-4 py-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-xl bg-surface-200"
              />
            ))}
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <EmptyState
            icon={Users}
            title="No patients found"
            description="Try adjusting search or filters, or register a new patient."
          />
        )}
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Register patient"
        size="lg"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {formError ? (
              <p className="text-sm text-rose-500">{formError}</p>
            ) : (
              <span />
            )}
            <PrimaryButton disabled={busy} onClick={() => void submitCreate()}>
              {busy ? "Saving…" : "Create patient"}
            </PrimaryButton>
          </div>
        }
      >
        <PatientForm values={form} onChange={setForm} mode="create" />
      </Modal>

      <Modal
        open={editId != null}
        onClose={() => setEditId(null)}
        title="Edit patient"
        size="lg"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {formError ? (
              <p className="text-sm text-rose-500">{formError}</p>
            ) : (
              <span />
            )}
            <PrimaryButton disabled={busy} onClick={() => void submitEdit()}>
              {busy ? "Saving…" : "Save changes"}
            </PrimaryButton>
          </div>
        }
      >
        <PatientForm
          values={form}
          onChange={setForm}
          mode="edit"
          insurance={editInsurance}
        />
      </Modal>

      {quickViewId && (
        <PatientQuickViewModal
          patientId={quickViewId}
          onClose={() => setQuickViewId(null)}
        />
      )}

      {vitalsPatient && (
        <RecordVitalsModal
          patientId={vitalsPatient.id}
          patientName={vitalsPatient.name}
          onClose={() => setVitalsPatient(null)}
          onSaved={() => void refresh()}
        />
      )}

      {importOpen && (
        <BulkImportDialog
          resource="patients"
          title="Import patients"
          description="Download the template, fill in patient details, then review before importing."
          onClose={() => setImportOpen(false)}
          onImported={async () => {
            await Promise.all([refresh(), refreshSummary()]);
          }}
        />
      )}
        </ScaffoldContainer>
      </PageLayout>
    </RoleGuard>
  );
}
