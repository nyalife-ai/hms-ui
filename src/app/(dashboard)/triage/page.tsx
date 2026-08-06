"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import { Avatar, Card, CardHeader, PageHeader } from "@/components/ui";
import { PaymentInfo, PipelineStepper, VisitQueueList } from "@/components/visit-flow";
import { useAuth } from "@/lib/auth";
import { useDoctors } from "@/lib/catalog";
import { useVisits, type Vitals } from "@/lib/visits";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

const EMPTY_VITALS: Vitals = {
  temperature: "",
  systolic: "",
  diastolic: "",
  pulse: "",
  respRate: "",
  spo2: "",
  weightKg: "",
};

const VITAL_FIELDS: { key: keyof Vitals; label: string; placeholder: string }[] = [
  { key: "temperature", label: "Temperature (°C)", placeholder: "36.8" },
  { key: "systolic", label: "BP Systolic (mmHg)", placeholder: "120" },
  { key: "diastolic", label: "BP Diastolic (mmHg)", placeholder: "80" },
  { key: "pulse", label: "Pulse (bpm)", placeholder: "72" },
  { key: "respRate", label: "Resp. Rate (/min)", placeholder: "16" },
  { key: "spo2", label: "SpO₂ (%)", placeholder: "98" },
  { key: "weightKg", label: "Weight (kg)", placeholder: "70" },
];

export default function TriagePage() {
  const { user } = useAuth();
  const { visits, recordTriage } = useVisits();
  const { data: doctors } = useDoctors();

  const queue = visits.filter((v) => v.stage === "CHECKED_IN");
  const [selectedId, setSelectedId] = useState<string>("");
  const [vitals, setVitals] = useState<Vitals>(EMPTY_VITALS);
  const [doctorName, setDoctorName] = useState("");

  const selected = queue.find((v) => v.id === selectedId) ?? queue[0];
  const availableDoctors = doctors.filter((d) => d.available);

  const vitalsComplete = VITAL_FIELDS.every((f) => vitals[f.key].trim() !== "");

  const submit = () => {
    if (!selected || !vitalsComplete || !doctorName || !user) return;
    recordTriage(selected.id, vitals, doctorName, user.name);
    setVitals(EMPTY_VITALS);
    setDoctorName("");
    setSelectedId("");
  };

  return (
    <RoleGuard module="triage">
      <PageHeader
        title="Triage"
        subtitle={`${queue.length} patient${queue.length === 1 ? "" : "s"} waiting for vitals`}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.4fr]">
        {/* Queue */}
        <Card className="h-fit">
          <CardHeader title="Waiting for Triage" subtitle="Sent from the front desk" />
          <VisitQueueList
            visits={queue}
            selectedId={selected?.id}
            onSelect={(id) => {
              setSelectedId(id);
              setVitals(EMPTY_VITALS);
            }}
            emptyMessage="No patients waiting. New check-ins from the front desk appear here."
          />
        </Card>

        {/* Vitals form */}
        {selected ? (
          <Card>
            <CardHeader
              title={`Vitals — ${selected.patientName}`}
              subtitle={`${selected.mrn} · ${selected.age} yrs · ${selected.gender}${selected.firstVisit ? " · First visit" : ""}`}
              action={<Avatar name={selected.patientName} />}
            />
            <div className="space-y-5 px-5 pb-5">
              <PipelineStepper visit={selected} />
              <PaymentInfo visit={selected} />

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {VITAL_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="text-xs font-semibold text-slate-600">{f.label}</label>
                    <input
                      className={`mt-1.5 ${inputClass}`}
                      value={vitals[f.key]}
                      onChange={(e) => setVitals({ ...vitals, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      inputMode="decimal"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Assign to available doctor</label>
                <select className={`mt-1.5 ${inputClass}`} value={doctorName} onChange={(e) => setDoctorName(e.target.value)}>
                  <option value="">Select a doctor in session…</option>
                  {availableDoctors.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name} — {d.specialty}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={submit}
                disabled={!vitalsComplete || !doctorName}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" /> Send to Doctor
              </button>
            </div>
          </Card>
        ) : (
          <Card className="flex min-h-64 items-center justify-center p-10 text-sm text-slate-400">
            Select a patient from the queue to record vitals.
          </Card>
        )}
      </div>
    </RoleGuard>
  );
}
