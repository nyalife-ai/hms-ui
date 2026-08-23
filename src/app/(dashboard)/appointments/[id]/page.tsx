"use client";

import {
  ArrowLeft,
  ClipboardList,
  FlaskConical,
  Pill,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { RoleGuard } from "@/components/role-guard";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  PageHeader,
  Table,
  type BadgeTone,
} from "@/components/ui";
import { api } from "@/lib/api";
import type { AppointmentDetail } from "@/lib/catalog";
import {
  consultationJourneyHref,
  relatedLabsHref,
  relatedPrescriptionsHref,
} from "@/lib/clinical-links";

const STATUS_TONES: Record<string, BadgeTone> = {
  Scheduled: "blue",
  "Checked In": "teal",
  Pending: "amber",
  Completed: "green",
  Cancelled: "red",
  IN_PROGRESS: "amber",
  PENDING: "amber",
};

function formatWhen(iso: string) {
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

export default function AppointmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api<AppointmentDetail>(`/catalog/appointments/${id}`);
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load visit record");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <RoleGuard module="appointments">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Home / Appointments / {detail?.appointmentNumber ?? "Visit"}
      </div>
      <PageHeader
        title={detail?.appointmentNumber ?? "Visit record"}
        subtitle={
          detail
            ? `${detail.patient.name} · ${detail.date} ${detail.time}`
            : loading
              ? "Loading visit…"
              : "Appointment detail"
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {detail?.visitId && (
              <Link
                href={consultationJourneyHref(detail.visitId)}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
              >
                Patient journey
              </Link>
            )}
            <Link
              href={relatedLabsHref({
                visitId: detail?.visitId ?? undefined,
                appointmentId: detail?.id ?? id,
                patientName: detail?.patient.name,
              })}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-300"
            >
              Labs
            </Link>
            <Link
              href={relatedPrescriptionsHref({
                visitId: detail?.visitId ?? undefined,
                appointmentId: detail?.id ?? id,
                patientName: detail?.patient.name,
              })}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-300"
            >
              Prescriptions
            </Link>
            <Link
              href="/appointments"
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
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
            <Card>
              <CardHeader title="Visit record" subtitle={detail.type} />
              <dl className="grid grid-cols-2 gap-3 px-5 pb-5 text-sm">
                <div>
                  <dt className="text-xs text-slate-400">Visit date</dt>
                  <dd className="font-semibold text-slate-900">{detail.date}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Scheduled time</dt>
                  <dd className="font-semibold text-slate-900">{detail.time}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Visit type</dt>
                  <dd className="font-semibold text-slate-900">{detail.type}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Visit status</dt>
                  <dd className="mt-1">
                    <Badge tone={STATUS_TONES[detail.status] ?? "slate"}>
                      {detail.status}
                    </Badge>
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-slate-400">Consultations</dt>
                  <dd className="font-semibold text-slate-900">
                    {detail.counts.consultations} consultation
                    {detail.counts.consultations === 1 ? "" : "s"}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card>
              <CardHeader
                title="Patient"
                action={<Avatar name={detail.patient.name} size="sm" />}
              />
              <div className="space-y-2 px-5 pb-5 text-sm">
                <p className="text-base font-bold text-slate-900">{detail.patient.name}</p>
                <p className="text-xs text-slate-400">
                  PAT-ID: {detail.patient.mrn}
                </p>
                <Badge tone={STATUS_TONES[detail.status] ?? "slate"}>
                  {detail.status}
                </Badge>
                <p className="pt-2 text-slate-600">
                  <span className="text-xs text-slate-400">Phone</span>
                  <br />
                  {detail.patient.phone || "—"}
                </p>
                <p className="text-slate-600">
                  <span className="text-xs text-slate-400">Email</span>
                  <br />
                  {detail.patient.email || "—"}
                </p>
                <p className="text-xs capitalize text-slate-500">
                  {detail.patient.gender.toLowerCase()}
                  {detail.patient.bloodGroup
                    ? ` · ${detail.patient.bloodGroup}`
                    : ""}
                </p>
              </div>
            </Card>

            <Card>
              <CardHeader title="Assigned provider" />
              <div className="space-y-2 px-5 pb-5 text-sm">
                <p className="text-xs text-slate-400">{detail.provider.title}</p>
                <p className="text-base font-bold text-slate-900">
                  {detail.provider.name}
                </p>
                <p className="text-slate-600">
                  <span className="text-xs text-slate-400">Specialization</span>
                  <br />
                  {detail.provider.specialization}
                </p>
                <p className="text-slate-600">
                  <span className="text-xs text-slate-400">Department</span>
                  <br />
                  {detail.provider.department}
                </p>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Visit summary" />
            <div className="grid grid-cols-1 gap-4 px-5 pb-5 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-slate-500">Reason for visit</p>
                <p className="mt-1.5 rounded-xl bg-slate-50 px-3.5 py-3 text-sm text-slate-700">
                  {detail.reason || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  Additional / reception notes
                </p>
                <p className="mt-1.5 rounded-xl bg-slate-50 px-3.5 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                  {detail.additionalNotes || detail.notes || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Booked on</p>
                <p className="text-sm font-medium text-slate-800">
                  {formatWhen(detail.bookedAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Last updated</p>
                <p className="text-sm font-medium text-slate-800">
                  {formatWhen(detail.updatedAt)}
                </p>
              </div>
              <div className="flex gap-6 text-sm md:col-span-2">
                <p>
                  <span className="text-slate-400">Lab requests</span>{" "}
                  <span className="font-semibold">{detail.counts.labRequests}</span>
                </p>
                <p>
                  <span className="text-slate-400">Prescriptions</span>{" "}
                  <span className="font-semibold">{detail.counts.prescriptions}</span>
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Clinical notes" />
            <div className="space-y-3 px-5 pb-5">
              {detail.clinicalNotes.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No clinical notes recorded"
                  description="Doctor notes will appear here once the consultation narrative is saved."
                  className="min-h-28"
                />
              ) : (
                detail.clinicalNotes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400">
                        {formatWhen(note.date)}
                      </span>
                      <Badge tone={STATUS_TONES[note.status] ?? "slate"}>
                        {note.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    {note.text}
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Clinical consultations" />
            <Table headers={["Record", "Date", "Diagnosis", "Status", "Actions"]}>
              {detail.consultations.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    {c.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {new Date(c.date).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{c.diagnosis}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={STATUS_TONES[c.status] ?? "slate"}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        const target =
                          c.href ||
                          (c.visitId
                            ? consultationJourneyHref(c.visitId)
                            : detail.visitId
                              ? consultationJourneyHref(detail.visitId)
                              : null);
                        if (target) router.push(target);
                      }}
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
                title="No consultations linked"
                description="Consultations appear after the doctor saves clinical notes or completes the visit."
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Laboratory requests" />
            <Table headers={["Request", "Test", "Priority", "Status", "Actions"]}>
              {detail.labRequests.map((lab) => (
                <tr key={lab.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    {lab.requestNumber}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{lab.test}</td>
                  <td className="px-4 py-2.5 text-slate-500">{lab.priority}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={STATUS_TONES[lab.status] ?? "slate"}>
                      {lab.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    {lab.id.startsWith("visit-") ? (
                      <Link
                        href={
                          detail.visitId
                            ? consultationJourneyHref(detail.visitId, "laboratory")
                            : relatedLabsHref({
                                visitId: detail.visitId ?? undefined,
                                appointmentId: detail.id,
                                patientName: detail.patient.name,
                              })
                        }
                        className="text-xs font-semibold text-brand-700 hover:underline"
                      >
                        Open
                      </Link>
                    ) : (
                      <Link
                        href={`/laboratory/requests/${lab.id}`}
                        className="text-xs font-semibold text-brand-700 hover:underline"
                      >
                        Open
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
            {detail.labRequests.length === 0 && (
              <EmptyState
                icon={FlaskConical}
                title="No lab tests requested"
                description="Laboratory requests ordered during this visit will appear here."
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Pharmacy orders" />
            <Table
              headers={["Prescription", "Medication", "Regimen", "Status", "Actions"]}
            >
              {detail.prescriptions.map((rx) => (
                <tr key={rx.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    {rx.prescriptionNumber}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{rx.medication}</td>
                  <td className="px-4 py-2.5 text-slate-500">{rx.regimen}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={STATUS_TONES[rx.status] ?? "slate"}>
                      {rx.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={relatedPrescriptionsHref({
                        visitId: detail.visitId ?? undefined,
                        appointmentId: detail.id,
                        patientName: detail.patient.name,
                      })}
                      className="text-xs font-semibold text-brand-700 hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </Table>
            {detail.prescriptions.length === 0 && (
              <EmptyState
                icon={Pill}
                title="No prescriptions issued"
                description="Pharmacy orders from this visit will appear here."
              />
            )}
          </Card>
        </div>
      )}
    </RoleGuard>
  );
}
