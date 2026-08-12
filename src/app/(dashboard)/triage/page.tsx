"use client";

import { Loader2, RefreshCw, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { DoctorSearchSelect } from "@/components/doctor-search-select";
import { RoleGuard } from "@/components/role-guard";
import { Avatar, Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { PaymentInfo, PipelineStepper, VisitQueueList } from "@/components/visit-flow";
import { useAuth } from "@/lib/auth";
import { useVisits, type Visit, type Vitals } from "@/lib/visits";

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

function fifo(visits: Visit[]) {
  return visits
    .slice()
    .sort(
      (a, b) =>
        new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime(),
    );
}

export default function TriagePage() {
  const { user } = useAuth();
  const { visits, loading, refresh, recordTriage } = useVisits();

  const queue = useMemo(
    () => fifo(visits.filter((v) => v.stage === "CHECKED_IN")),
    [visits],
  );
  const atFinance = useMemo(
    () => fifo(visits.filter((v) => v.stage === "AWAITING_PAYMENT")),
    [visits],
  );

  const [selectedId, setSelectedId] = useState<string>("");
  const [vitals, setVitals] = useState<Vitals>(EMPTY_VITALS);
  const [doctorStaffId, setDoctorStaffId] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [error, setError] = useState("");

  const selected = queue.find((v) => v.id === selectedId) ?? queue[0];
  const vitalsComplete = VITAL_FIELDS.every((f) => vitals[f.key].trim() !== "");
  const doctorReady = Boolean(doctorStaffId && doctorName);

  const onRefresh = async () => {
    setRefreshBusy(true);
    setError("");
    try {
      await refresh();
    } finally {
      setRefreshBusy(false);
    }
  };

  const submit = async () => {
    if (!selected || !vitalsComplete || !doctorReady || !user) return;
    setSubmitBusy(true);
    setError("");
    try {
      await recordTriage(
        selected.id,
        vitals,
        doctorName,
        user.name,
        doctorStaffId,
      );
      setVitals(EMPTY_VITALS);
      setDoctorStaffId("");
      setDoctorName("");
      setSelectedId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send to doctor");
    } finally {
      setSubmitBusy(false);
    }
  };

  return (
    <RoleGuard module="triage">
      <PageHeader
        title="Triage"
        subtitle={`${queue.length} ready · ${atFinance.length} still at finance · oldest first`}
        action={
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={refreshBusy || loading}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
          >
            {refreshBusy || loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </button>
        }
      />

      {error && (
        <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <Card className="h-fit">
            <CardHeader
              title="Waiting for Triage"
              subtitle="Fees are charged at the front desk — oldest check-ins first"
            />
            <VisitQueueList
              visits={queue}
              selectedId={selected?.id}
              onSelect={(id) => {
                setSelectedId(id);
                setVitals(EMPTY_VITALS);
                setError("");
              }}
              emptyMessage="No patients waiting. After finance payment they return here automatically."
            />
          </Card>

          {atFinance.length > 0 && (
            <Card className="h-fit">
              <CardHeader
                title="Still at finance"
                subtitle="Waiting for consultation-fee payment before triage"
              />
              <ul className="space-y-1 px-3 pb-4">
                {atFinance.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5">
                    <Avatar name={v.patientName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {v.patientName}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {v.billing?.invoiceNumber ?? "Draft invoice"} · pay at Billing
                      </p>
                    </div>
                    <Badge tone="amber">Unpaid</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

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

              {(selected.reasonForVisit || selected.additionalNotes) && (
                <div className="rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3 text-sm">
                  {selected.reasonForVisit && (
                    <p>
                      <span className="font-semibold text-slate-700">Reason for visit: </span>
                      <span className="text-slate-600">{selected.reasonForVisit}</span>
                    </p>
                  )}
                  {selected.additionalNotes && (
                    <p className={selected.reasonForVisit ? "mt-1.5" : undefined}>
                      <span className="font-semibold text-slate-700">Reception notes: </span>
                      <span className="text-slate-600">{selected.additionalNotes}</span>
                    </p>
                  )}
                </div>
              )}

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
                <label className="text-xs font-semibold text-slate-600">
                  Assign to doctor
                </label>
                <div className="mt-1.5">
                  <DoctorSearchSelect
                    value={doctorStaffId}
                    onChange={(id, doctor) => {
                      setDoctorStaffId(id);
                      setDoctorName(doctor?.name ?? "");
                    }}
                    placeholder="Search doctor by name or specialty…"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => void submit()}
                disabled={!vitalsComplete || !doctorReady || submitBusy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitBusy ? "Sending…" : "Send to Doctor"}
              </button>
            </div>
          </Card>
        ) : (
          <Card className="flex min-h-64 items-center justify-center p-10 text-sm text-slate-400">
            Select a patient from the triage queue to record vitals.
          </Card>
        )}
      </div>
    </RoleGuard>
  );
}
