"use client";

import {
  Activity,
  CalendarDays,
  ClipboardList,
  Eye,
  FolderOpen,
  HeartPulse,
  Pencil,
  Stethoscope,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Modal } from "@/components/modal";
import {
  EMPTY_PATIENT_FORM,
  PatientForm,
  toPatientsUpdateBody,
  validatePatientForm,
  type PatientFormValues,
} from "@/components/patient-form";
import { RoleGuard } from "@/components/role-guard";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  PageHeader,
  PrimaryButton,
  StatCard,
  Table,
  type BadgeTone,
} from "@/components/ui";
import { api } from "@/lib/api";
import type { PatientDetail } from "@/lib/catalog";

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      time: d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  } catch {
    return { date: iso || "—", time: "" };
  }
}

const STATUS_TONES: Record<string, BadgeTone> = {
  Pending: "amber",
  Scheduled: "blue",
  "Checked In": "teal",
  Completed: "green",
  Cancelled: "red",
  IN_PROGRESS: "amber",
  COMPLETED: "green",
  SCHEDULED: "blue",
};

function formatDate(iso: string) {
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
      d.lastName || d.name.trim().split(/\s+/).slice(1).join(" ") || "",
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

export default function PatientProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<PatientFormValues>(EMPTY_PATIENT_FORM);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [consultationId, setConsultationId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("consultationId");
  });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const data = await api<PatientDetail>(`/catalog/patients/${id}`);
      setDetail(data);
    } catch (err) {
      setDetail(null);
      setError(err instanceof Error ? err.message : "Unable to load patient");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // Fetch patient detail when route id changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data load
    void load();
  }, [load]);

  const activeConsultation = useMemo(() => {
    if (!detail || !consultationId) return null;
    return detail.consultations.find((c) => c.id === consultationId) ?? null;
  }, [detail, consultationId]);

  const openEdit = () => {
    if (!detail) return;
    setForm(detailToForm(detail));
    setFormError("");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!id) return;
    const err = validatePatientForm(form, { requirePhone: false });
    if (err) {
      setFormError(err);
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api(`/patients/${id}`, {
        method: "PATCH",
        body: JSON.stringify(toPatientsUpdateBody(form)),
      });
      setEditOpen(false);
      await load();
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Unable to save changes.",
      );
    } finally {
      setBusy(false);
    }
  };

  const scheduledAppts =
    detail?.scheduledAppointments ??
    detail?.appointments.filter(
      (a) => a.rawStatus === "SCHEDULED" || a.rawStatus === "CONFIRMED",
    ) ??
    [];
  const scheduledFollowUps = detail?.scheduledFollowUps ?? [];

  return (
    <RoleGuard module="patients">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Home / Patients / {detail?.mrn ?? "Patient"}
      </div>
      <PageHeader
        title={detail?.mrn ?? "Patient record"}
        subtitle={
          detail
            ? `${detail.name} · REF: ${detail.referenceCode}`
            : loading
              ? "Loading…"
              : error
                ? "Could not load profile"
                : "Patient profile"
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {detail && (
              <PrimaryButton onClick={openEdit}>
                <Pencil className="h-3.5 w-3.5" /> Edit patient
              </PrimaryButton>
            )}
            <Link
              href="/patients"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-300"
            >
              Back to registry
            </Link>
          </div>
        }
      />

      {error && !loading && (
        <Card className="mb-4 p-5">
          <p className="text-sm font-medium text-rose-600">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 text-xs font-semibold text-brand-700 hover:underline"
          >
            Retry
          </button>
        </Card>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      )}

      {!loading && !error && !detail && (
        <Card className="p-8 text-center text-sm text-slate-500">
          No patient found for this id.
        </Card>
      )}

      {detail && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Age"
              value={detail.age > 0 ? String(detail.age) : "—"}
              deltaLabel={detail.dateOfBirth || "DOB unknown"}
              icon={UserRound}
            />
            <button
              type="button"
              onClick={() => setScheduledOpen(true)}
              className="text-left"
            >
              <StatCard
                label="Scheduled visits"
                value={String(detail.counts.scheduledVisits)}
                deltaLabel="View appointments & follow-ups"
                icon={CalendarDays}
              />
            </button>
            <StatCard
              label="Consultations"
              value={String(detail.counts.consultations)}
              deltaLabel="On file"
              icon={Stethoscope}
            />
            <button
              type="button"
              onClick={() => setVitalsOpen(true)}
              className="text-left"
            >
              <StatCard
                label="Vitals on file"
                value={String(detail.counts.vitals)}
                deltaLabel="View history"
                icon={Activity}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
            <Card>
              <CardHeader
                title="Patient profile"
                action={<Avatar name={detail.name} size="sm" />}
              />
              <div className="space-y-2 px-5 pb-5 text-sm">
                <p className="text-base font-bold text-slate-900">{detail.name}</p>
                <p className="text-xs text-slate-400">PAT-ID: {detail.mrn}</p>
                <p className="text-xs text-slate-400">REF: {detail.referenceCode}</p>
                <p className="pt-2">
                  <span className="text-xs text-slate-400">Phone</span>
                  <br />
                  <span className="font-medium">{detail.phone || "—"}</span>
                </p>
                <p>
                  <span className="text-xs text-slate-400">Email</span>
                  <br />
                  <span className="font-medium">{detail.email || "—"}</span>
                </p>
                <p>
                  <span className="text-xs text-slate-400">Address</span>
                  <br />
                  <span className="font-medium">
                    {[detail.address, detail.city, detail.country, detail.postalCode]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </span>
                </p>
                <p>
                  <span className="text-xs text-slate-400">Date of birth</span>
                  <br />
                  <span className="font-medium">{detail.dateOfBirth || "—"}</span>
                </p>
                <p>
                  <span className="text-xs text-slate-400">Registered</span>
                  <br />
                  <span className="font-medium">
                    {formatDate(detail.registeredAt)}
                  </span>
                </p>
              </div>
            </Card>

            <Card>
              <CardHeader title="Emergency & clinical" />
              <div className="space-y-2 px-5 pb-5 text-sm">
                <p>
                  <span className="text-xs text-slate-400">Next of kin</span>
                  <br />
                  <span className="font-semibold">
                    {detail.emergencyContact?.name || "Not specified"}
                  </span>
                </p>
                <p>
                  <span className="text-xs text-slate-400">Contact line</span>
                  <br />
                  <span className="font-medium">
                    {detail.emergencyContact?.phone || "—"}
                  </span>
                </p>
                <p>
                  <span className="text-xs text-slate-400">Allergies</span>
                  <br />
                  <span className="font-medium">{detail.allergies || "—"}</span>
                </p>
                <p>
                  <span className="text-xs text-slate-400">Chronic diseases</span>
                  <br />
                  <span className="font-medium">
                    {detail.chronicDiseases || "—"}
                  </span>
                </p>
                {(detail.insurance?.length ?? 0) > 0 && (
                  <div className="pt-2">
                    <span className="text-xs text-slate-400">Insurance</span>
                    <ul className="mt-1 space-y-1">
                      {detail.insurance!.map((pol) => (
                        <li key={pol.id} className="text-sm font-medium">
                          {pol.providerName}
                          {pol.memberId ? ` · ${pol.memberId}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Demographics & biometrics"
                action={
                  <button
                    type="button"
                    onClick={() => setVitalsOpen(true)}
                    className="text-slate-400 hover:text-brand-700"
                    aria-label="View vitals history"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                }
              />
              <div className="space-y-2 px-5 pb-5 text-sm">
                <p className="text-xs font-semibold text-slate-500">
                  Physical profile
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <p>
                    <span className="text-xs text-slate-400">Height</span>
                    <br />
                    {detail.physical.height != null
                      ? `${detail.physical.height} cm`
                      : "—"}
                  </p>
                  <p>
                    <span className="text-xs text-slate-400">Weight</span>
                    <br />
                    {detail.physical.weight != null
                      ? `${detail.physical.weight} kg`
                      : "—"}
                  </p>
                </div>
                <p>
                  <span className="text-xs text-slate-400">Blood group</span>
                  <br />
                  {detail.bloodGroup || "—"}
                </p>
                <p>
                  <span className="text-xs text-slate-400">Occupation</span>
                  <br />
                  {detail.occupation || "—"}
                </p>
                <p>
                  <span className="text-xs text-slate-400">Marital status</span>
                  <br />
                  {detail.maritalStatus || "—"}
                </p>
                <p>
                  <span className="text-xs text-slate-400">Prescriptions</span>{" "}
                  <span className="font-semibold">
                    {detail.counts.prescriptions}
                  </span>
                </p>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Latest vitals snapshot"
              action={
                <button
                  type="button"
                  onClick={() => setVitalsOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
                >
                  <Eye className="h-3.5 w-3.5" /> History
                </button>
              }
            />
            <div className="px-5 pb-5 text-sm text-slate-600">
              {!detail.latestVitals ? (
                <EmptyState
                  icon={HeartPulse}
                  title="No vitals recorded yet"
                  description="No vitals have been recorded for this patient."
                  className="min-h-32"
                />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <p>
                    BP{" "}
                    <span className="font-semibold">
                      {detail.latestVitals.bloodPressure || "—"}
                    </span>
                  </p>
                  <p>
                    Pulse{" "}
                    <span className="font-semibold">
                      {detail.latestVitals.heartRate ?? "—"}
                    </span>
                  </p>
                  <p>
                    Temp{" "}
                    <span className="font-semibold">
                      {detail.latestVitals.temperature ?? "—"}
                    </span>
                  </p>
                  <p>
                    SpO₂{" "}
                    <span className="font-semibold">
                      {detail.latestVitals.oxygenSaturation ?? "—"}
                    </span>
                  </p>
                  <p>
                    Weight{" "}
                    <span className="font-semibold">
                      {detail.latestVitals.weight ?? "—"}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400 sm:col-span-3">
                    Measured {formatDate(detail.latestVitals.measuredAt)}
                    {detail.latestVitals.source
                      ? ` · ${detail.latestVitals.source}`
                      : ""}
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Visit timeline" />
            <Table headers={["Encounter", "When", "Provider", "Status", ""]}>
              {(
                detail.visitTimeline ??
                detail.appointments.map((a) => ({
                  id: a.id,
                  kind: "appointment" as const,
                  label: a.appointmentNumber,
                  date: a.date,
                  time: a.time,
                  when: `${a.date}T${a.time}`,
                  provider: a.provider,
                  status: a.status,
                  summary: "",
                  href: `/appointments/${a.id}`,
                }))
              ).map((item) => (
                <tr
                  key={`${item.kind}-${item.id}`}
                  className="hover:bg-slate-50/60"
                >
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    {item.kind === "consultation" ? (
                      <button
                        type="button"
                        className="hover:text-brand-700"
                        onClick={() => setConsultationId(item.id)}
                      >
                        {item.label}
                      </button>
                    ) : (
                      <Link href={item.href} className="hover:text-brand-700">
                        {item.label}
                      </Link>
                    )}
                    {item.summary ? (
                      <p className="text-xs font-normal text-slate-400">
                        {item.summary}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {item.date}
                    <br />
                    <span className="text-xs">{item.time}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{item.provider}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={STATUS_TONES[item.status] ?? "slate"}>
                      {item.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    {item.kind === "consultation" ? (
                      <button
                        type="button"
                        onClick={() => setConsultationId(item.id)}
                        className="text-xs font-semibold text-brand-700 hover:underline"
                      >
                        Open
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        className="text-xs font-semibold text-brand-700 hover:underline"
                      >
                        Open
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
            {(detail.visitTimeline?.length ?? detail.appointments.length) ===
              0 && (
              <EmptyState
                icon={FolderOpen}
                title="No visits on file"
                description="This patient has no appointments, visits, or consultations in the timeline yet."
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Consultations" />
            <Table
              headers={[
                "Record",
                "Date",
                "Physician",
                "Diagnosis",
                "Status",
                "Actions",
              ]}
            >
              {detail.consultations.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    {c.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {new Date(c.date).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{c.physician}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.diagnosis}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={STATUS_TONES[c.status] ?? "slate"}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setConsultationId(c.id)}
                      className="text-xs font-semibold text-brand-700 hover:underline"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
            {detail.consultations.length === 0 && (
              <EmptyState
                icon={ClipboardList}
                title="No consultations yet"
                description="No consultation records are available for this patient."
              />
            )}
          </Card>
        </div>
      )}

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit patient"
        size="lg"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {formError ? (
              <p className="text-sm text-rose-500">{formError}</p>
            ) : (
              <span />
            )}
            <PrimaryButton disabled={busy} onClick={() => void saveEdit()}>
              {busy ? "Saving…" : "Save changes"}
            </PrimaryButton>
          </div>
        }
      >
        <PatientForm
          values={form}
          onChange={setForm}
          mode="edit"
          insurance={detail?.insurance}
        />
      </Modal>

      <Modal
        open={vitalsOpen}
        onClose={() => setVitalsOpen(false)}
        title="Vitals history"
        size="lg"
      >
        {!detail?.vitalsHistory?.length ? (
          <EmptyState
            icon={HeartPulse}
            title="No vitals on file"
            description="No vitals have been recorded for this patient."
          />
        ) : (
          <ul className="space-y-3">
            {detail.vitalsHistory.map((v) => {
              const when = formatDateTime(v.measuredAt);
              return (
                <li
                  key={v.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-slate-800">
                      {when.date}
                      {when.time ? ` · ${when.time}` : ""}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge tone="slate">{v.source ?? "VITALS"}</Badge>
                      {v.urgencyLevel === "EMERGENCY" ? (
                        <Badge tone="red">Emergency</Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-slate-600 sm:grid-cols-3">
                    <p>
                      Temp{" "}
                      <span className="font-semibold">
                        {v.temperature ?? "—"}
                      </span>
                    </p>
                    <p>
                      BP{" "}
                      <span className="font-semibold">
                        {v.bloodPressure || "—"}
                      </span>
                    </p>
                    <p>
                      HR{" "}
                      <span className="font-semibold">
                        {v.heartRate ?? "—"}
                      </span>
                    </p>
                    <p>
                      RR{" "}
                      <span className="font-semibold">
                        {v.respiratoryRate ?? "—"}
                      </span>
                    </p>
                    <p>
                      SpO₂{" "}
                      <span className="font-semibold">
                        {v.oxygenSaturation ?? "—"}
                      </span>
                    </p>
                    <p>
                      Wt{" "}
                      <span className="font-semibold">{v.weight ?? "—"}</span>
                    </p>
                    <p>
                      Ht{" "}
                      <span className="font-semibold">{v.height ?? "—"}</span>
                    </p>
                    <p>
                      BMI{" "}
                      <span className="font-semibold">{v.bmi ?? "—"}</span>
                    </p>
                    <p>
                      Pain{" "}
                      <span className="font-semibold">
                        {v.painLevel ?? "—"}
                      </span>
                    </p>
                  </div>
                  {v.notes ? (
                    <p className="mt-2 text-xs text-slate-500">{v.notes}</p>
                  ) : null}
                  {v.recordedBy ? (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Recorded by {v.recordedBy}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      <Modal
        open={scheduledOpen}
        onClose={() => setScheduledOpen(false)}
        title="Scheduled visits"
        size="md"
      >
        <div className="space-y-4">
          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-brand-600">
              Appointments
            </p>
            {scheduledAppts.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No scheduled appointments"
                description="This patient has no upcoming scheduled or confirmed appointments."
                className="min-h-28"
              />
            ) : (
              <ul className="space-y-2">
                {scheduledAppts.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/appointments/${a.id}`}
                      className="block rounded-xl border border-slate-100 px-3 py-2 text-sm hover:border-brand-200"
                    >
                      <span className="font-semibold">{a.appointmentNumber}</span>
                      <span className="text-slate-500">
                        {" "}
                        · {a.date} {a.time}
                      </span>
                      <p className="text-xs text-slate-400">
                        {a.provider} · {a.status}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-brand-600">
              Follow-ups
            </p>
            {scheduledFollowUps.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No scheduled follow-ups"
                description="This patient has no upcoming follow-up visits."
                className="min-h-28"
              />
            ) : (
              <ul className="space-y-2">
                {scheduledFollowUps.map((f) => (
                  <li
                    key={f.id}
                    className="rounded-xl border border-slate-100 px-3 py-2 text-sm"
                  >
                    <span className="font-semibold">{f.date}</span>
                    <Badge tone="blue">Follow-up</Badge>
                    <p className="text-xs text-slate-500">
                      {f.reason || "Follow-up"}
                      {f.provider ? ` · ${f.provider}` : ""}
                      {f.status ? ` · ${f.status}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </Modal>

      <Modal
        open={consultationId != null}
        onClose={() => setConsultationId(null)}
        title="Consultation detail"
        size="md"
      >
        {!activeConsultation ? (
          <p className="text-sm text-slate-400">Consultation not found.</p>
        ) : (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                Date
              </dt>
              <dd className="font-medium">
                {new Date(activeConsultation.date).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                Physician
              </dt>
              <dd className="font-medium">{activeConsultation.physician}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                Status
              </dt>
              <dd>
                <Badge tone={STATUS_TONES[activeConsultation.status] ?? "slate"}>
                  {activeConsultation.status}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                Chief complaint
              </dt>
              <dd className="font-medium">
                {activeConsultation.chiefComplaint || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                Primary diagnosis
              </dt>
              <dd className="font-medium">{activeConsultation.diagnosis}</dd>
            </div>
            {(activeConsultation.diagnoses?.length ?? 0) > 0 && (
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                  Diagnoses
                </dt>
                <dd>
                  <ul className="mt-1 space-y-1">
                    {activeConsultation.diagnoses!.map((d, i) => (
                      <li key={`${d.code}-${i}`}>
                        {d.code ? `${d.code} · ` : ""}
                        {d.description}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {activeConsultation.notes ? (
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                  Notes
                </dt>
                <dd className="whitespace-pre-wrap text-slate-700">
                  {activeConsultation.notes}
                </dd>
              </div>
            ) : null}
          </dl>
        )}
      </Modal>
    </RoleGuard>
  );
}
