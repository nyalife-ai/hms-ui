"use client";

import {
  ChevronLeft,
  Clock3,
  FilePlus2,
  FlaskConical,
  Info,
  Pill,
  Stethoscope,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
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

type Tab = "details" | "notes" | "labs" | "prescriptions";

export function AppointmentQuickViewModal({
  appointmentId,
  onClose,
}: {
  appointmentId: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("details");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
      <div className="flex max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-slate-100 bg-[#faf7f9]">
          <div className="px-4 pb-3 pt-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
              Appointment info
            </p>
            <h2 className="mt-1 text-base font-bold text-slate-900">
              Visit: {firstName}
            </h2>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-2">
            {(
              [
                { id: "details", label: "Visit Details", icon: Info },
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
                      : "font-medium text-slate-600 hover:bg-white/70"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${active ? "text-brand-600" : "text-slate-400"}`}
                  />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={onClose}
            className="m-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to List
          </button>
        </aside>

        <div className="relative min-w-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 text-slate-400 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>

          {loading && <p className="text-sm text-slate-400">Loading visit…</p>}
          {error && <p className="text-sm text-rose-500">{error}</p>}

          {detail && !loading && tab === "details" && (
            <div className="space-y-5 pr-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Appointment info
                  </p>
                  <dl className="mt-3 space-y-3 text-sm">
                    <div>
                      <dt className="text-xs text-slate-400">Date</dt>
                      <dd className="font-semibold text-slate-900">{detail.date}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">Time</dt>
                      <dd className="font-semibold text-slate-900">{detail.time}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">Status</dt>
                      <dd className="mt-1">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                          <Clock3 className="h-3 w-3" />
                          {statusLabel}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Medical team
                  </p>
                  <dl className="mt-3 space-y-3 text-sm">
                    <div>
                      <dt className="text-xs text-slate-400">Doctor</dt>
                      <dd className="font-semibold text-slate-900">
                        {detail.provider.name}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">Department</dt>
                      <dd className="font-semibold text-slate-900">
                        {detail.provider.department}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Reason for visit
                </p>
                <div className="mt-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {detail.reason || "No reason recorded for this visit."}
                </div>
              </div>

              {(detail.additionalNotes || detail.notes) && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Additional notes
                  </p>
                  <div className="mt-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                    {detail.additionalNotes || detail.notes}
                  </div>
                </div>
              )}

              <Link
                href={
                  detail.visitId
                    ? consultationJourneyHref(detail.visitId)
                    : `/appointments/${detail.id}`
                }
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:border-brand-300 hover:text-brand-700"
              >
                View Full Records
              </Link>
            </div>
          )}

          {detail && !loading && tab === "notes" && (
            <div className="pr-6">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Consultation data
              </p>
              {detail.clinicalNotes.length === 0 &&
              !detail.notes &&
              !detail.additionalNotes ? (
                <div className="mt-4 flex min-h-48 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-6 text-center">
                  <FilePlus2 className="mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">
                    No clinical notes recorded yet.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {detail.additionalNotes && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                      <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">
                        Reception notes
                      </p>
                      {detail.additionalNotes}
                    </div>
                  )}
                  {detail.notes &&
                    detail.notes !== detail.additionalNotes && (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                        <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">
                          Triage & internal notes
                        </p>
                        {detail.notes}
                      </div>
                    )}
                  {detail.clinicalNotes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase text-slate-400">
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
            <div className="pr-6">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Laboratory
              </p>
              {detail.labRequests.length === 0 ? (
                <div className="mt-4 flex min-h-48 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-6 text-center">
                  <FlaskConical className="mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">
                    No lab requests for this visit.
                  </p>
                </div>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {detail.labRequests.map((lab) => (
                    <li
                      key={lab.id}
                      className="flex items-start justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{lab.test}</p>
                        <p className="text-xs text-slate-400">{lab.requestNumber}</p>
                      </div>
                      <Badge tone={STATUS_TONES[lab.status] ?? "amber"}>{lab.status}</Badge>
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
                className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:underline"
              >
                See related labs →
              </Link>
            </div>
          )}

          {detail && !loading && tab === "prescriptions" && (
            <div className="pr-6">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Medical orders
              </p>
              {detail.prescriptions.length === 0 ? (
                <div className="mt-4 flex min-h-48 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-6 text-center">
                  <Pill className="mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">
                    No prescriptions found for this visit.
                  </p>
                </div>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {detail.prescriptions.map((rx) => (
                    <li
                      key={rx.id}
                      className="flex items-start justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{rx.medication}</p>
                        <p className="text-xs text-slate-400">{rx.regimen}</p>
                        <p className="text-[11px] text-slate-400">
                          {rx.prescriptionNumber}
                        </p>
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
                className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:underline"
              >
                See prescriptions →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
