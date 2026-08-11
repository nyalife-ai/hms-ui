"use client";

import {
  Pencil,
  Plus,
  UserRound,
  Users,
  UserRoundPlus,
  Venus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FieldLabel } from "@/components/field-label";
import { PaginationBar } from "@/components/pagination-bar";
import { PatientQuickViewModal } from "@/components/patient-quick-view-modal";
import { PatientRowActions } from "@/components/patient-row-actions";
import { RecordVitalsModal } from "@/components/record-vitals-modal";
import { RoleGuard } from "@/components/role-guard";
import { TableAction } from "@/components/table-action";
import {
  Avatar,
  Badge,
  Card,
  PageHeader,
  PrimaryButton,
  StatCard,
  Table,
} from "@/components/ui";
import { api } from "@/lib/api";
import {
  usePaginatedCatalog,
  usePatientSummary,
  type CatalogPatient,
} from "@/lib/catalog";
import { toPageMeta } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

export default function PatientsPage() {
  const router = useRouter();
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

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<CatalogPatient | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [genderForm, setGenderForm] = useState<"Male" | "Female" | "Other">("Female");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [allergies, setAllergies] = useState("");
  const [chronic, setChronic] = useState("");
  const [kinName, setKinName] = useState("");
  const [kinPhone, setKinPhone] = useState("");

  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [vitalsPatient, setVitalsPatient] = useState<CatalogPatient | null>(null);

  const resetCreate = () => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setDateOfBirth("");
    setGenderForm("Female");
    setAllergies("");
    setChronic("");
    setKinName("");
    setKinPhone("");
    setFormError("");
  };

  const submit = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setFormError("First name, last name and phone are required.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api("/ops/patients", {
        method: "POST",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          gender: genderForm,
          phone: phone.trim(),
          dateOfBirth: dateOfBirth || undefined,
          allergies: allergies.trim() || undefined,
          chronicDiseases: chronic.trim() || undefined,
          emergencyContactName: kinName.trim() || undefined,
          emergencyContactPhone: kinPhone.trim() || undefined,
        }),
      });
      setOpen(false);
      resetCreate();
      await Promise.all([refresh(), refreshSummary()]);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to register the patient. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (p: CatalogPatient) => {
    const parts = p.name.trim().split(/\s+/);
    setEdit(p);
    setFirstName(parts[0] || "");
    setLastName(parts.slice(1).join(" ") || "");
    setPhone(p.phone || "");
    setFormError("");
  };

  const saveEdit = async () => {
    if (!edit) return;
    if (!firstName.trim() || !lastName.trim()) {
      setFormError("Name is required.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api(`/patients/${edit.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
        }),
      });
      setEdit(null);
      await refresh();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to save changes. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const meta = toPageMeta({ total, page, limit });
  const kpi = summary ?? { total: 0, female: 0, male: 0, recent7d: 0 };

  return (
    <RoleGuard module="patients">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Home / Patients / Patients Registry
      </div>
      <PageHeader
        title="Patients"
        subtitle={
          loading ? "Loading patients…" : `${total.toLocaleString()} in the registry`
        }
        action={
          <PrimaryButton
            onClick={() => {
              resetCreate();
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Register patient
          </PrimaryButton>
        }
      />

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
        <Table headers={["Patient", "MRN", "Age", "Gender", "Phone", "Last visit", "Status", "Actions"]}>
          {!loading &&
            items.map((p) => (
              <tr key={p.id} className="transition hover:bg-slate-50/60">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} size="sm" />
                    <span className="font-medium text-slate-800">{p.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{p.mrn}</td>
                <td className="px-4 py-2.5 text-slate-500">{p.age || "—"}</td>
                <td className="px-4 py-2.5 text-slate-500">{p.gender}</td>
                <td className="px-4 py-2.5 text-slate-500">{p.phone}</td>
                <td className="px-4 py-2.5 text-slate-500">{p.lastVisit}</td>
                <td className="px-4 py-2.5">
                  <Badge
                    tone={
                      p.status === "Admitted" ? "amber" : p.status === "Active" ? "green" : "slate"
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
                      onClick={() => openEdit(p)}
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
              <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        )}
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Register patient</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel required>First name</FieldLabel>
                  <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <FieldLabel required>Last name</FieldLabel>
                  <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div>
                <FieldLabel required>Gender</FieldLabel>
                <select className={inputClass} value={genderForm} onChange={(e) => setGenderForm(e.target.value as "Male" | "Female" | "Other")}>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <FieldLabel required>Phone</FieldLabel>
                <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <FieldLabel optional>Date of birth</FieldLabel>
                <input className={inputClass} type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>
              <div>
                <FieldLabel optional>Allergies</FieldLabel>
                <input className={inputClass} value={allergies} onChange={(e) => setAllergies(e.target.value)} />
              </div>
              <div>
                <FieldLabel optional>Chronic conditions</FieldLabel>
                <input className={inputClass} value={chronic} onChange={(e) => setChronic(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel optional>Next of kin</FieldLabel>
                  <input className={inputClass} value={kinName} onChange={(e) => setKinName(e.target.value)} />
                </div>
                <div>
                  <FieldLabel optional>Kin phone</FieldLabel>
                  <input className={inputClass} value={kinPhone} onChange={(e) => setKinPhone(e.target.value)} />
                </div>
              </div>
              {formError && <p className="text-sm text-rose-500">{formError}</p>}
              <PrimaryButton disabled={busy} onClick={submit}>
                {busy ? "Saving…" : "Create patient"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Edit patient</h2>
              <button type="button" onClick={() => setEdit(null)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div>
              <FieldLabel required>First name</FieldLabel>
              <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <FieldLabel required>Last name</FieldLabel>
              <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            {formError && <p className="text-sm text-rose-500">{formError}</p>}
            <PrimaryButton disabled={busy} onClick={saveEdit}>
              {busy ? "Saving…" : "Save changes"}
            </PrimaryButton>
          </div>
        </div>
      )}

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
    </RoleGuard>
  );
}
