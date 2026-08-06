"use client";

import { Check, ShieldCheck, Banknote } from "lucide-react";
import { Avatar, Badge } from "./ui";
import { STAGE_META, PIPELINE_STEPS, formatTime, type Visit } from "@/lib/visits";

export function PipelineStepper({ visit }: { visit: Visit }) {
  const current = STAGE_META[visit.stage].step;
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1">
      {PIPELINE_STEPS.map((step, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={step} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${
                  done
                    ? "bg-brand-500 text-white"
                    : active
                      ? "bg-brand-100 text-brand-700 ring-2 ring-brand-400"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {done ? <Check className="h-3 w-3" /> : idx}
              </span>
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
}: {
  visits: Visit[];
  selectedId?: string;
  onSelect: (id: string) => void;
  emptyMessage: string;
}) {
  if (visits.length === 0) {
    return <p className="px-5 pb-5 text-sm text-slate-400">{emptyMessage}</p>;
  }
  return (
    <ul className="space-y-1 px-3 pb-4">
      {visits.map((v) => (
        <li key={v.id}>
          <button
            onClick={() => onSelect(v.id)}
            className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${
              selectedId === v.id ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-slate-50"
            }`}
          >
            <Avatar name={v.patientName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{v.patientName}</p>
              <p className="text-[11px] text-slate-400">
                {v.mrn} · in at {formatTime(v.checkedInAt)}
              </p>
            </div>
            <Badge tone={STAGE_META[v.stage].tone}>{STAGE_META[v.stage].label}</Badge>
          </button>
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
  const { payment } = visit;
  if (payment.method === "CASH") {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-[#f3f7f7] px-3.5 py-3">
        <Banknote className="h-4 w-4 shrink-0 text-slate-400" />
        <p className="text-sm font-medium text-slate-700">Paying cash</p>
      </div>
    );
  }
  const tone =
    payment.status === "APPROVED" ? "teal" : payment.status === "REJECTED" ? "red" : "amber";
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-[#f3f7f7] px-3.5 py-3">
      <ShieldCheck className="h-4 w-4 shrink-0 text-brand-500" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-700">{payment.provider}</p>
        <p className="text-[11px] text-slate-400">
          Policy {payment.policyNumber}
          {payment.benefitBalance ? ` · Balance KES ${payment.benefitBalance.toLocaleString()}` : ""}
        </p>
      </div>
      <Badge tone={tone}>
        {payment.status === "APPROVED" ? "Cover approved" : payment.status === "REJECTED" ? "Rejected" : "Pending"}
      </Badge>
    </div>
  );
}
