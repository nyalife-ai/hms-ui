"use client";

import {
  ChevronLeft,
  Clock3,
  FilePlus2,
  FlaskConical,
  Info,
  Pill,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Modal } from "@/components/modal";
import { Badge, type BadgeTone } from "@/components/ui";
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
};

type Tab = "info" | "details" | "notes" | "labs" | "prescriptions";

export function AppointmentQuickViewModal({
  appointmentId,
  onClose,
}: {
  appointmentId: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("info");
  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api<AppointmentDetail>(
          `/catalog/appointments/${appointmentId}`,
        );
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) {
          setDetail(null);
          setError(err instanceof Error ? err.message : "Unable to load visit");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  const firstName = detail?.patient.name?.split(" ")[0] || "Visit";
  const statusLabel =
    detail?.status === "Scheduled" ? "Pending" : detail?.status || "—";

  return (
    <Modal open onClose={onClose} size="xl" hideHeader>
      <div className="flex max-h-[80vh] overflow-hidden">
        <aside className="flex w-[200px] shrink-0 flex-col border-r border-border bg-[#faf7f9] sm:w-[220px]">
          <div className="px-4 pb-3 pt-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
              Appointment
            </p>
            <h2 className="mt-1 text-base font-bold text-foreground">
              Visit: {firstName}
            </h2>
            {detail?.appointmentNumber ? (
              <p className="mt-0.5 text-xs text-foreground-lighter">
                {detail.appointmentNumber}
              </p>
            ) : null}
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-2">
            {(
              [
                { id: "info", label: "Appointment Info", icon: Info },
                { id: "details", label: "Visit Details", icon: Clock3 },
                { id: "notes", label: "Clinical Notes", icon: Stethoscope },
                { id: "labs", label: "Labs", icon: FlaskConical },
                { id: "prescriptions", label: "Prescriptions", icon: Pill },
              ] as const
            ).map((item) => {
              const active = tab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    active
                      ? "bg-white font-semibold text-brand-700 shadow-sm"
                      : "font-medium text-foreground-light hover:bg-white/70"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${active ? "text-brand-600" : "text-foreground-lighter"}`}
                  />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={onClose}
            className="m-3 inline-flex items-center gap-1 text-xs font-medium text-foreground-light hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to List
          </button>
        </aside>

        <div className="relative min-w-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {loading && (
            <div className="space-y-3 py-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl bg-surface-200"
                />
              ))}
            </div>
          )}
          {error && !loading && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              <p className="font-medium">Unable to load appointment</p>
              <p className="mt-1 text-xs">{error}</p>
            </div>
          )}

          {detail && !loading && tab === "info" && (
            <div className="space-y-5">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="text-xs text-foreground-lighter">Date / time</dt>
                  <dd className="font-semibold">
                    {detail.date} · {detail.time}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-foreground-lighter">Status</dt>
                  <dd className="mt-1">
                    <Badge tone={STATUS_TONES[detail.status] ?? "slate"}>
                      {statusLabel}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-foreground-lighter">Patient</dt>
                  <dd className="font-semibold">{detail.patient.name}</dd>
                  <dd className="text-xs text-foreground-lighter">{detail.patient.mrn}</dd>
                </div>
                <div>
                  <dt className="text-xs text-foreground-lighter">Doctor</dt>
                  <dd className="font-semibold">{detail.provider.name}</dd>
                  <dd className="text-xs text-foreground-lighter">
                    {detail.provider.department}
                  </dd>
                </div>
              </dl>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-lighter">
                  Reason for visit
                </p>
                <div className="mt-2 rounded-xl bg-surface-200 px-4 py-3 text-sm text-foreground">
                  {detail.reason || "No reason recorded for this visit."}
                </div>
              </div>
              {(detail.additionalNotes || detail.notes) && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-lighter">
                    Reception notes
                  </p>
                  <div className="mt-2 rounded-xl bg-surface-200 px-4 py-3 text-sm whitespace-pre-wrap text-foreground">
                    {detail.additionalNotes || detail.notes}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-4 text-sm">
                <p>
                  Consultations{" "}
                  <span className="font-semibold">
                    {detail.counts.consultations}
                  </span>
                </p>
                <p>
                  Labs{" "}
                  <span className="font-semibold">
                    {detail.counts.labRequests}
                  </span>
                </p>
                <p>
                  Rx{" "}
                  <span className="font-semibold">
                    {detail.counts.prescriptions}
                  </span>
                </p>
              </div>
              <Link
                href={`/appointments/${detail.id}`}
                className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:border-brand-300 hover:text-brand-700"
              >
                View full appointment record
              </Link>
            </div>
          )}

          {detail && !loading && tab === "details" && (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-foreground-lighter">Visit stage</dt>
                  <dd className="font-semibold">
                    {detail.visitStage?.replace(/_/g, " ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-foreground-lighter">Type</dt>
                  <dd className="font-semibold">{detail.type}</dd>
                </div>
              </dl>
              {detail.visitId ? (
                <Link
                  href={consultationJourneyHref(detail.visitId)}
                  className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:border-brand-300 hover:text-brand-700"
                >
                  Open consultation journey
                </Link>
              ) : (
                <p className="text-sm text-foreground-light">
                  No outpatient visit linked yet (patient may not be checked in).
                </p>
              )}
              {detail.consultations.length > 0 && (
                <ul className="space-y-2">
                  {detail.consultations.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={
                          c.href ||
                          (c.visitId
                            ? consultationJourneyHref(c.visitId)
                            : detail.visitId
                              ? consultationJourneyHref(detail.visitId)
                              : `/appointments/${detail.id}`)
                        }
                        onClick={onClose}
                        className="block rounded-xl border border-border px-3 py-2 text-sm hover:border-brand-200"
                      >
                        <span className="font-semibold">{c.diagnosis}</span>
                        <span className="text-xs text-foreground-lighter">
                          {" "}
                          · {c.status}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {detail && !loading && tab === "notes" && (
            <div>
              {detail.clinicalNotes.length === 0 &&
              !detail.notes &&
              !detail.additionalNotes ? (
                <EmptyState
                  icon={FilePlus2}
                  title="No clinical notes recorded"
                  description="Notes appear after triage or the doctor saves the consultation narrative."
                />
              ) : (
                <div className="space-y-3">
                  {detail.additionalNotes && (
                    <div className="rounded-xl border border-border bg-surface-200 px-4 py-3 text-sm whitespace-pre-wrap">
                      <p className="mb-1 text-[10px] font-semibold uppercase text-foreground-lighter">
                        Reception notes
                      </p>
                      {detail.additionalNotes}
                    </div>
                  )}
                  {detail.notes &&
                    detail.notes !== detail.additionalNotes && (
                      <div className="rounded-xl border border-border bg-surface-200 px-4 py-3 text-sm whitespace-pre-wrap">
                        <p className="mb-1 text-[10px] font-semibold uppercase text-foreground-lighter">
                          Visit notes
                        </p>
                        {detail.notes}
                      </div>
                    )}
                  {detail.clinicalNotes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-xl border border-border bg-surface-200 px-4 py-3 text-sm whitespace-pre-wrap"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase text-foreground-lighter">
                          {new Date(note.date).toLocaleString()}
                        </p>
                        <Badge tone={STATUS_TONES[note.status] ?? "slate"}>
                          {note.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      {note.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {detail && !loading && tab === "labs" && (
            <div>
              {detail.labRequests.length === 0 ? (
                <EmptyState
                  icon={FlaskConical}
                  title="No lab requests for this visit"
                  description="Orders placed during the consultation will appear here."
                />
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {detail.labRequests.map((lab) => (
                    <li
                      key={lab.id}
                      className="flex items-start justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-foreground">{lab.test}</p>
                        <p className="text-xs text-foreground-lighter">
                          {lab.requestNumber}
                        </p>
                      </div>
                      <Badge tone={STATUS_TONES[lab.status] ?? "amber"}>
                        {lab.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={relatedLabsHref({
                  visitId: detail.visitId ?? undefined,
                  appointmentId: detail.id,
                  patientName: detail.patient.name,
                })}
                onClick={onClose}
                className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:underline"
              >
                See related labs →
              </Link>
            </div>
          )}

          {detail && !loading && tab === "prescriptions" && (
            <div>
              {detail.prescriptions.length === 0 ? (
                <EmptyState
                  icon={Pill}
                  title="No prescriptions for this visit"
                  description="Pharmacy orders from the consultation will appear here."
                />
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {detail.prescriptions.map((rx) => (
                    <li
                      key={rx.id}
                      className="flex items-start justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-foreground">
                          {rx.medication}
                        </p>
                        <p className="text-xs text-foreground-lighter">{rx.regimen}</p>
                      </div>
                      <Badge tone="amber">{rx.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={relatedPrescriptionsHref({
                  visitId: detail.visitId ?? undefined,
                  appointmentId: detail.id,
                  patientName: detail.patient.name,
                })}
                onClick={onClose}
                className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:underline"
              >
                See prescriptions →
              </Link>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
