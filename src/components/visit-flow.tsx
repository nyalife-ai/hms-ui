"use client";

import { Check, ShieldCheck, Banknote } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, Badge } from "./ui";
import { priorityTone } from "@/lib/triage";
import { STAGE_META, PIPELINE_STEPS, formatTime, type Visit } from "@/lib/visits";

export function PipelineStepper({
  visit,
  activeStep,
  onStepClick,
}: {
  visit: Visit;
  activeStep?: number;
  onStepClick?: (step: number) => void;
}) {
  const current = STAGE_META[visit.stage].step;
  const highlighted = activeStep ?? current;
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1">
      {PIPELINE_STEPS.map((step, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === highlighted;
        const clickable = Boolean(onStepClick);
        return (
          <div key={step} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStepClick?.(idx)}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${
                  done
                    ? "bg-brand-500 text-white"
                    : active
                      ? "bg-brand-100 text-brand-700 ring-2 ring-brand-400"
                      : "bg-slate-100 text-slate-400"
                } ${clickable ? "cursor-pointer hover:ring-2 hover:ring-brand-300" : ""}`}
              >
                {done && idx !== highlighted ? <Check className="h-3 w-3" /> : idx}
              </button>
              <span className={`whitespace-nowrap text-[9px] ${active ? "font-semibold text-brand-700" : "text-slate-400"}`}>
                {step}
              </span>
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <span className={`mb-4 h-0.5 w-5 rounded-full ${done ? "bg-brand-400" : "bg-slate-100"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function VisitQueueList({
  visits,
  selectedId,
  onSelect,
  emptyMessage,
  trailing,
}: {
  visits: Visit[];
  selectedId?: string;
  onSelect: (id: string) => void;
  emptyMessage: string;
  trailing?: (visit: Visit) => ReactNode;
}) {
  if (visits.length === 0) {
    return <p className="px-5 pb-5 text-sm text-slate-400">{emptyMessage}</p>;
  }
  return (
    <ul className="space-y-1 px-3 pb-4">
      {visits.map((v) => (
        <li key={v.id} className="flex items-center gap-1">
          <button
            onClick={() => onSelect(v.id)}
            className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${
              selectedId === v.id ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-slate-50"
            }`}
          >
            <Avatar name={v.patientName} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {v.patientName}
                </p>
                {(v.triagePriority || v.triage?.priority) &&
                  (v.triagePriority || v.triage?.priority) !== "NORMAL" && (
                    <Badge tone={priorityTone(v.triagePriority || v.triage?.priority)}>
                      {v.triagePriority || v.triage?.priority}
                    </Badge>
                  )}
              </div>
              <p className="text-[11px] text-slate-400">
                {v.mrn} · {v.age} yrs · {v.gender}
              </p>
              {(v.triage?.chiefComplaint || v.reasonForVisit) && (
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {v.triage?.chiefComplaint || v.reasonForVisit}
                </p>
              )}
              <p className="text-[10px] text-slate-400">
                {v.triageCompletedAt || v.triage?.completedAt
                  ? `Triaged ${formatTime(v.triageCompletedAt || v.triage!.completedAt)}`
                  : `In at ${formatTime(v.checkedInAt)}`}
              </p>
            </div>
            <Badge tone={STAGE_META[v.stage].tone}>{STAGE_META[v.stage].label}</Badge>
          </button>
          {trailing?.(v)}
        </li>
      ))}
    </ul>
  );
}

export function VitalsGrid({ visit }: { visit: Visit }) {
  if (!visit.vitals) return null;
  const v = visit.vitals;
  const entries = [
    { label: "Temperature", value: `${v.temperature} °C` },
    { label: "Blood Pressure", value: `${v.systolic}/${v.diastolic} mmHg` },
    { label: "Pulse", value: `${v.pulse} bpm` },
    { label: "Resp. Rate", value: `${v.respRate} /min` },
    { label: "SpO₂", value: `${v.spo2} %` },
    { label: "Weight", value: `${v.weightKg} kg` },
    ...(v.heightCm ? [{ label: "Height", value: `${v.heightCm} cm` }] : []),
    ...(v.bmi ? [{ label: "BMI", value: `${v.bmi} kg/m²` }] : []),
    ...(v.painScore
      ? [
          {
            label: "Pain",
            value: `${v.painScore}/10${v.painLocation ? ` · ${v.painLocation}` : ""}`,
          },
        ]
      : []),
    ...(v.bloodGlucose
      ? [
          {
            label: "Glucose",
            value: `${v.bloodGlucose}${v.bloodGlucoseContext ? ` (${v.bloodGlucoseContext})` : ""}`,
          },
        ]
      : []),
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {entries.map((e) => (
        <div key={e.label} className="rounded-xl bg-[#f3f7f7] px-3 py-2.5">
          <p className="text-[10px] text-slate-400">{e.label}</p>
          <p className="text-sm font-semibold text-slate-800">{e.value}</p>
        </div>
      ))}
    </div>
  );
}

export function PaymentInfo({ visit }: { visit: Visit }) {
  const fee = visit.billing?.consultFeeStatus;
  const feeAmount = visit.billing?.consultFeeAmount ?? visit.billing?.total;
  const feeBlock =
    fee === "PAID" ? (
      <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-3.5 py-3">
        <Check className="h-4 w-4 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-emerald-900">Consultation fee paid</p>
          <p className="text-[11px] text-emerald-700/80">
            {visit.billing?.invoiceNumber ? `${visit.billing.invoiceNumber} · ` : ""}
            {feeAmount != null ? `KES ${Number(feeAmount).toLocaleString()}` : ""}
            {visit.billing?.paymentChannel ? ` · ${visit.billing.paymentChannel}` : ""}
          </p>
        </div>
        <Badge tone="green">Paid</Badge>
      </div>
    ) : fee === "PENDING" ? (
      <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3">
        <Banknote className="h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-900">Send patient to finance</p>
          <p className="text-[11px] text-amber-800/80">
            Draft invoice {visit.billing?.invoiceNumber ?? ""}
            {feeAmount != null ? ` · KES ${Number(feeAmount).toLocaleString()}` : ""}
          </p>
        </div>
        <Badge tone="amber">Unpaid</Badge>
      </div>
    ) : fee === "WAIVED" ? (
      <div className="flex items-center gap-2.5 rounded-xl bg-[#f3f7f7] px-3.5 py-3">
        <Banknote className="h-4 w-4 shrink-0 text-slate-400" />
        <p className="text-sm font-medium text-slate-700">Consultation fee waived</p>
      </div>
    ) : null;

  const payMethod =
    visit.payment.method === "CASH" ? (
      <div className="flex items-center gap-2.5 rounded-xl bg-[#f3f7f7] px-3.5 py-3">
        <Banknote className="h-4 w-4 shrink-0 text-slate-400" />
        <p className="text-sm font-medium text-slate-700">Paying cash / M-Pesa</p>
      </div>
    ) : (
      (() => {
        const tone =
          visit.payment.status === "APPROVED"
            ? "teal"
            : visit.payment.status === "REJECTED"
              ? "red"
              : "amber";
        return (
          <div className="flex items-center gap-2.5 rounded-xl bg-[#f3f7f7] px-3.5 py-3">
            <ShieldCheck className="h-4 w-4 shrink-0 text-brand-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-700">{visit.payment.provider}</p>
              <p className="text-[11px] text-slate-400">
                Policy {visit.payment.policyNumber}
                {visit.payment.benefitBalance
                  ? ` · Balance KES ${visit.payment.benefitBalance.toLocaleString()}`
                  : ""}
              </p>
            </div>
            <Badge tone={tone}>
              {visit.payment.status === "APPROVED"
                ? "Cover approved"
                : visit.payment.status === "REJECTED"
                  ? "Rejected"
                  : "Pending"}
            </Badge>
          </div>
        );
      })()
    );

  return (
    <div className="space-y-2">
      {feeBlock}
      {payMethod}
    </div>
  );
}
