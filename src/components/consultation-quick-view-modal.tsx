"use client";

import {
  ChevronLeft,
  FilePlus2,
  FlaskConical,
  Info,
  Pill,
  Stethoscope,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui";
import { PaymentInfo, VitalsGrid } from "@/components/visit-flow";
import { api } from "@/lib/api";
import {
  consultationJourneyHref,
  relatedLabsHref,
  relatedPrescriptionsHref,
} from "@/lib/clinical-links";
import type { VisitLabReport } from "@/lib/lab-types";
import { STAGE_META, type Visit } from "@/lib/visits";

type Tab = "details" | "clinical" | "labs" | "prescriptions";

export function ConsultationQuickViewModal({
  visit,
  onClose,
}: {
  visit: Visit;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("details");
  const [labReport, setLabReport] = useState<VisitLabReport | null>(null);
  const firstName = visit.patientName.split(" ")[0] || "Visit";
  const clinical = visit.clinicalRecord;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const report = await api<VisitLabReport>(
          `/laboratory/visit-report?visitId=${encodeURIComponent(visit.id)}`,
        );
        if (!cancelled) setLabReport(report);
      } catch {
        if (!cancelled) setLabReport(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visit.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
      <div className="flex max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-slate-100 bg-[#faf7f9]">
          <div className="px-4 pb-3 pt-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
              Consultation
            </p>
            <h2 className="mt-1 text-base font-bold text-slate-900">
              Visit: {firstName}
            </h2>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-2">
            {(
              [
                { id: "details", label: "Visit Details", icon: Info },
                { id: "clinical", label: "Clinical Notes", icon: Stethoscope },
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

          {tab === "details" && (
            <div className="space-y-4 pr-6">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{visit.patientName}</p>
                  <p className="text-xs text-slate-400">
                    {visit.mrn} · {visit.age} yrs · {visit.gender}
                  </p>
                </div>
                <Badge tone={STAGE_META[visit.stage].tone}>
                  {STAGE_META[visit.stage].label}
                </Badge>
              </div>
              <PaymentInfo visit={visit} />
              {visit.reasonForVisit && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Reason for visit
                  </p>
                  <p className="mt-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {visit.reasonForVisit}
                  </p>
                </div>
              )}
              {visit.additionalNotes && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Reception notes
                  </p>
                  <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {visit.additionalNotes}
                  </p>
                </div>
              )}
              <VitalsGrid visit={visit} />
              <Link
                href={consultationJourneyHref(visit.id)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:border-brand-300 hover:text-brand-700"
              >
                View Full Records
              </Link>
              {visit.appointmentId ? (
                <Link
                  href={`/appointments/${visit.appointmentId}`}
                  className="ml-2 inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-300"
                >
                  Open appointment
                </Link>
              ) : null}
              {visit.patientId ? (
                <Link
                  href={`/patients/${visit.patientId}`}
                  className="ml-2 inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-300"
                >
                  Open patient
                </Link>
              ) : null}
            </div>
          )}

          {tab === "clinical" && (
            <div className="pr-6">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Consultation data
              </p>
              {!clinical?.chiefComplaint &&
              !clinical?.impression &&
              !visit.diagnosis &&
              !clinical?.historyPresentIllness ? (
                <div className="mt-4 flex min-h-48 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-6 text-center">
                  <FilePlus2 className="mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">
                    No clinical notes recorded yet.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  {clinical?.chiefComplaint && (
                    <NoteBlock title="Chief complaint" text={clinical.chiefComplaint} />
                  )}
                  {clinical?.historyPresentIllness && (
                    <NoteBlock title="HPI" text={clinical.historyPresentIllness} />
                  )}
                  {clinical?.generalExamination && (
                    <NoteBlock title="Examination" text={clinical.generalExamination} />
                  )}
                  {(clinical?.impression || visit.diagnosis) && (
                    <NoteBlock
                      title="Impression / diagnosis"
                      text={clinical?.impression || visit.diagnosis || ""}
                    />
                  )}
                  {clinical?.treatmentPlan && (
                    <NoteBlock title="Plan" text={clinical.treatmentPlan} />
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "labs" && (
            <div className="pr-6">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Laboratory
              </p>
              {!visit.labOrder?.tests?.length && !(labReport?.lines.length) ? (
                <div className="mt-4 flex min-h-48 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-6 text-center">
                  <FlaskConical className="mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">
                    No lab requests for this visit.
                  </p>
                </div>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {(labReport?.released && labReport.lines.length
                    ? labReport.lines.map((l) => ({
                        key: l.id,
                        name: l.parameterName ?? l.testName ?? "—",
                        range: l.normalReferenceRange ?? "",
                        result: l.resultValue
                          ? `${l.resultValue}${l.unitOfMeasurement ? ` ${l.unitOfMeasurement}` : ""}`
                          : null,
                      }))
                    : (visit.labOrder?.tests ?? []).map((t) => ({
                        key: t.name,
                        name: t.name,
                        range: t.range,
                        result: null as string | null,
                      }))
                  ).map((row) => (
                    <li
                      key={row.key}
                      className="flex items-start justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{row.name}</p>
                        <p className="text-xs text-slate-400">{row.range}</p>
                      </div>
                      <Badge tone={row.result ? "green" : "amber"}>
                        {row.result || (labReport?.released ? "Released" : "Pending")}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={relatedLabsHref({
                  visitId: visit.id,
                  appointmentId: visit.appointmentId,
                  patientName: visit.patientName,
                })}
                className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:underline"
              >
                See related labs →
              </Link>
            </div>
          )}

          {tab === "prescriptions" && (
            <div className="pr-6">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Medical orders
              </p>
              {!visit.prescriptions?.length ? (
                <div className="mt-4 flex min-h-48 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-6 text-center">
                  <Pill className="mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">
                    No prescriptions found for this visit.
                  </p>
                </div>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {visit.prescriptions.map((rx, i) => (
                    <li key={`${rx.medication}-${i}`} className="px-4 py-3 text-sm">
                      <p className="font-semibold text-slate-800">{rx.medication}</p>
                      <p className="text-xs text-slate-400">
                        {[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(" · ")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={relatedPrescriptionsHref({
                  visitId: visit.id,
                  appointmentId: visit.appointmentId,
                  patientName: visit.patientName,
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

function NoteBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 whitespace-pre-wrap">
      <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">{title}</p>
      {text}
    </div>
  );
}
