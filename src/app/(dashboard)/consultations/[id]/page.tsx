"use client";

import { ArrowLeft, Play, Save } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { DoctorSearchSelect } from "@/components/doctor-search-select";
import { RoleGuard } from "@/components/role-guard";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { PaymentInfo, PipelineStepper, VitalsGrid } from "@/components/visit-flow";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  relatedLabsHref,
  relatedPrescriptionsHref,
} from "@/lib/clinical-links";
import { isOversightRole, type Role } from "@/lib/roles";
import {
  PIPELINE_TAB_IDS,
  STAGE_META,
  formatTime,
  useVisits,
  type PipelineTabId,
  type Visit,
  type Vitals,
} from "@/lib/visits";

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

function tabFromStage(stage: Visit["stage"]): PipelineTabId {
  const step = STAGE_META[stage].step;
  return PIPELINE_TAB_IDS[Math.max(0, Math.min(step - 1, PIPELINE_TAB_IDS.length - 1))];
}

function canEdit(
  role: Role | undefined,
  desks: Role[],
): boolean {
  if (!role) return false;
  return isOversightRole(role) || desks.includes(role);
}

function JourneyInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const {
    visits,
    refresh,
    updateReception,
    recordTriage,
    startConsultation,
    collectConsultFee,
    waiveConsultFee,
    completeConsultation,
    updateClaimStatus,
  } = useVisits();

  const id = params?.id;
  const [remote, setRemote] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const visit = visits.find((v) => v.id === id) ?? remote;

  const requestedTab = searchParams.get("tab") as PipelineTabId | null;
  const tab: PipelineTabId =
    requestedTab && (PIPELINE_TAB_IDS as readonly string[]).includes(requestedTab)
      ? requestedTab
      : visit
        ? tabFromStage(visit.stage)
        : "reception";
  const activeStep = PIPELINE_TAB_IDS.indexOf(tab) + 1;

  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [vitals, setVitals] = useState<Vitals>(EMPTY_VITALS);
  const [doctorStaffId, setDoctorStaffId] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [diagnosis, setDiagnosis] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await api<Visit>(`/visits/${id}`);
        if (!cancelled) {
          setRemote(data);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Visit not found");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!visit) return;
    setReason(visit.reasonForVisit ?? "");
    setNotes(visit.additionalNotes ?? "");
    setVitals(visit.vitals ?? EMPTY_VITALS);
    setDoctorStaffId(visit.doctorStaffId ?? "");
    setDoctorName(visit.doctorName ?? "");
    setDiagnosis(visit.diagnosis ?? visit.clinicalRecord?.impression ?? "");
  }, [visit?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setTab = (next: PipelineTabId) => {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set("tab", next);
    router.replace(`/consultations/${id}?${qs.toString()}`);
  };

  const role = user?.role;
  const editReception = canEdit(role, ["RECEPTIONIST"]);
  const editTriage = canEdit(role, ["NURSE"]);
  const editDoctor = canEdit(role, ["DOCTOR"]);
  const editBilling = canEdit(role, ["ACCOUNTANT", "RECEPTIONIST"]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg("");
    setError("");
    try {
      await fn();
      await refresh();
      const data = await api<Visit>(`/visits/${id}`);
      setRemote(data);
      setMsg("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const clinicalBits = useMemo(() => {
    if (!visit) return [];
    const c = visit.clinicalRecord;
    return [
      c?.chiefComplaint && { title: "Chief complaint", text: c.chiefComplaint },
      c?.historyPresentIllness && { title: "HPI", text: c.historyPresentIllness },
      c?.generalExamination && { title: "Examination", text: c.generalExamination },
      (c?.impression || visit.diagnosis) && {
        title: "Impression",
        text: c?.impression || visit.diagnosis || "",
      },
      c?.treatmentPlan && { title: "Plan", text: c.treatmentPlan },
    ].filter(Boolean) as { title: string; text: string }[];
  }, [visit]);

  return (
    <RoleGuard module="consultations">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Home / Consultations / Journey
      </div>
      <PageHeader
        title={visit?.patientName ?? "Patient journey"}
        subtitle={
          visit
            ? `${visit.mrn} · ${visit.age} yrs · ${visit.gender} · ${STAGE_META[visit.stage].label}`
            : loading
              ? "Loading visit…"
              : "Consultation journey"
        }
        action={
          <Link
            href="/consultations"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Queue
          </Link>
        }
      />

      {error && <p className="mb-3 text-sm text-rose-500">{error}</p>}
      {msg && <p className="mb-3 text-sm text-emerald-600">{msg}</p>}

      {loading && !visit && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      )}

      {visit && (
        <div className="space-y-4">
          <Card>
            <div className="px-5 py-4">
              <PipelineStepper
                visit={visit}
                activeStep={activeStep}
                onStepClick={(step) => setTab(PIPELINE_TAB_IDS[step - 1])}
              />
            </div>
          </Card>

          {tab === "reception" && (
            <Card>
              <CardHeader
                title="Reception"
                subtitle="Check-in reason, notes, and payment"
                action={<Badge tone={STAGE_META[visit.stage].tone}>{STAGE_META[visit.stage].label}</Badge>}
              />
              <div className="space-y-4 px-5 pb-5">
                <PaymentInfo visit={visit} />
                <div>
                  <label className="text-xs font-medium text-slate-500">Reason for visit</label>
                  <textarea
                    className={`${inputClass} mt-1 min-h-[72px]`}
                    value={reason}
                    disabled={!editReception || busy}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Reception notes</label>
                  <textarea
                    className={`${inputClass} mt-1 min-h-[72px]`}
                    value={notes}
                    disabled={!editReception || busy}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                {editReception && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        updateReception(visit.id, {
                          reasonForVisit: reason,
                          additionalNotes: notes,
                        }),
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" /> Save reception
                  </button>
                )}
                {visit.stage === "AWAITING_PAYMENT" && editBilling && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                      onClick={() => void run(() => collectConsultFee(visit.id, "CASH"))}
                    >
                      Collect cash fee
                    </button>
                    {canEdit(role, ["ACCOUNTANT"]) && (
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                        onClick={() => void run(() => waiveConsultFee(visit.id))}
                      >
                        Waive fee
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}

          {tab === "triage" && (
            <Card>
              <CardHeader title="Triage" subtitle="Vitals and assigned doctor" />
              <div className="space-y-4 px-5 pb-5">
                {visit.vitals && <VitalsGrid visit={visit} />}
                {visit.nurseName && (
                  <p className="text-sm text-slate-500">
                    Triaged by <span className="font-medium text-slate-800">{visit.nurseName}</span>
                    {visit.doctorName ? ` · assigned to ${visit.doctorName}` : ""}
                  </p>
                )}
                {editTriage && (
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {(
                        [
                          ["temperature", "Temp °C"],
                          ["systolic", "Systolic"],
                          ["diastolic", "Diastolic"],
                          ["pulse", "Pulse"],
                          ["respRate", "RR"],
                          ["spo2", "SpO₂"],
                          ["weightKg", "Weight kg"],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key}>
                          <label className="text-[10px] text-slate-400">{label}</label>
                          <input
                            className={inputClass}
                            value={vitals[key]}
                            onChange={(e) =>
                              setVitals((v) => ({ ...v, [key]: e.target.value }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <DoctorSearchSelect
                      value={doctorStaffId}
                      onChange={(staffId, doctor) => {
                        setDoctorStaffId(staffId);
                        setDoctorName(doctor?.name ?? "");
                      }}
                    />
                    <button
                      type="button"
                      disabled={busy || !doctorStaffId}
                      onClick={() =>
                        void run(() =>
                          recordTriage(visit.id, {
                            vitals,
                            doctorName,
                            nurseName: user?.name || "Nurse",
                            doctorStaffId,
                            reasonForVisit:
                              visit.triage?.reasonForVisit ||
                              visit.reasonForVisit ||
                              "General check-up",
                            chiefComplaint:
                              visit.triage?.chiefComplaint ||
                              visit.reasonForVisit ||
                              "Triage update",
                            priority: visit.triage?.priority || "NORMAL",
                            priorityReason: visit.triage?.priorityReason,
                            notes: visit.triage?.notes,
                            symptoms: visit.triage?.symptoms,
                            relevantHistory: visit.triage?.relevantHistory,
                            assessment: visit.triage?.assessment,
                            contextsEnabled: visit.triage?.contextsEnabled,
                            antenatal: visit.triage?.antenatal,
                            gynaecological: visit.triage?.gynaecological,
                            paediatric: visit.triage?.paediatric,
                            chronic: visit.triage?.chronic,
                          }),
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" /> Save triage
                    </button>
                  </>
                )}
                {!visit.vitals && !editTriage && (
                  <p className="text-sm text-slate-400">Vitals have not been recorded yet.</p>
                )}
              </div>
            </Card>
          )}

          {tab === "doctor" && (
            <Card>
              <CardHeader
                title="Doctor"
                subtitle={visit.doctorName ? `Physician: ${visit.doctorName}` : "Consultation"}
              />
              <div className="space-y-4 px-5 pb-5">
                {clinicalBits.length === 0 ? (
                  <p className="text-sm text-slate-400">No clinical notes yet.</p>
                ) : (
                  clinicalBits.map((b) => (
                    <div key={b.title} className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
                      <p className="text-[10px] font-semibold uppercase text-slate-400">{b.title}</p>
                      <p className="mt-1 whitespace-pre-wrap text-slate-700">{b.text}</p>
                    </div>
                  ))
                )}
                {visit.stage === "WAITING_DOCTOR" && editDoctor && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => startConsultation(visit.id))}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    <Play className="h-4 w-4" /> Start Consultation
                  </button>
                )}
                {editDoctor && (
                  <Link
                    href="/consultations"
                    className="inline-flex text-sm font-semibold text-brand-700 hover:underline"
                  >
                    Open consult workspace →
                  </Link>
                )}
              </div>
            </Card>
          )}

          {tab === "laboratory" && (
            <Card>
              <CardHeader title="Laboratory" subtitle="Orders and results for this visit" />
              <div className="space-y-4 px-5 pb-5">
                {!visit.labOrder?.tests?.length ? (
                  <p className="text-sm text-slate-400">No laboratory tests ordered yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                    {visit.labOrder.tests.map((t) => (
                      <li key={t.name} className="flex items-center justify-between px-4 py-3 text-sm">
                        <div>
                          <p className="font-medium text-slate-800">{t.name}</p>
                          <p className="text-xs text-slate-400">{t.range}</p>
                        </div>
                        <Badge tone={t.result ? "green" : "amber"}>{t.result || "Pending"}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
                {visit.labOrder?.notes && (
                  <p className="text-xs text-slate-400">Notes: {visit.labOrder.notes}</p>
                )}
                <Link
                  href={relatedLabsHref({
                    visitId: visit.id,
                    appointmentId: visit.appointmentId,
                    patientName: visit.patientName,
                  })}
                  className="inline-flex text-sm font-semibold text-brand-700 hover:underline"
                >
                  See related labs →
                </Link>
              </div>
            </Card>
          )}

          {tab === "diagnosis" && (
            <Card>
              <CardHeader title="Diagnosis" subtitle="Outcome, prescriptions, follow-up" />
              <div className="space-y-4 px-5 pb-5">
                {visit.diagnosis && (
                  <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800">
                    {visit.diagnosis}
                  </p>
                )}
                {visit.prescriptions && visit.prescriptions.length > 0 && (
                  <ul className="text-sm text-slate-600">
                    {visit.prescriptions.map((p, i) => (
                      <li key={`${p.medication}-${i}`}>
                        {p.medication} — {[p.dosage, p.frequency, p.duration].filter(Boolean).join(" · ")}
                      </li>
                    ))}
                  </ul>
                )}
                {visit.followUpDate && (
                  <p className="text-sm text-slate-500">Follow-up: {visit.followUpDate}</p>
                )}
                {editDoctor &&
                  (visit.stage === "IN_CONSULTATION" || visit.stage === "RESULTS_READY") && (
                    <div className="space-y-2">
                      <input
                        className={inputClass}
                        placeholder="Diagnosis / impression"
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                      />
                      <button
                        type="button"
                        disabled={busy || !diagnosis.trim()}
                        onClick={() =>
                          void run(() =>
                            completeConsultation(visit.id, {
                              diagnosis: diagnosis.trim(),
                              prescriptions: visit.prescriptions ?? [],
                              followUpDate: visit.followUpDate,
                              clinicalRecord: visit.clinicalRecord,
                              orderedServices: visit.orderedServices,
                              orderedSurgeries: visit.orderedSurgeries,
                            }),
                          )
                        }
                        className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Complete consultation
                      </button>
                    </div>
                  )}
                <Link
                  href={relatedPrescriptionsHref({
                    visitId: visit.id,
                    appointmentId: visit.appointmentId,
                    patientName: visit.patientName,
                  })}
                  className="inline-flex text-sm font-semibold text-brand-700 hover:underline"
                >
                  See prescriptions →
                </Link>
              </div>
            </Card>
          )}

          {tab === "billing" && (
            <Card>
              <CardHeader title="Billing" subtitle="Invoices, receipts, and settlement" />
              <div className="space-y-3 px-5 pb-5 text-sm">
                {visit.billing ? (
                  <dl className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-xs text-slate-400">Invoice</dt>
                      <dd className="font-medium">{visit.billing.invoiceNumber || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">Amount</dt>
                      <dd className="font-medium">
                        {visit.billing.total != null
                          ? `KES ${Number(visit.billing.total).toLocaleString()}`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">Channel</dt>
                      <dd className="font-medium">{visit.billing.paymentChannel || visit.billing.mode}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">Consult fee</dt>
                      <dd className="font-medium">{visit.billing.consultFeeStatus || "—"}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-slate-400">No billing recorded yet.</p>
                )}
                {editBilling && (
                  <Link href="/billing" className="inline-flex font-semibold text-brand-700 hover:underline">
                    Open billing desk →
                  </Link>
                )}
              </div>
            </Card>
          )}

          {tab === "insurer" && (
            <Card>
              <CardHeader title="Insurer" subtitle="Claim status for this visit" />
              <div className="space-y-3 px-5 pb-5 text-sm">
                <p>
                  Cover: {visit.payment.method}
                  {visit.payment.provider ? ` · ${visit.payment.provider}` : ""}
                </p>
                <p>Authorization: {visit.payment.status || "—"}</p>
                {visit.billing?.claimId && (
                  <p>
                    Claim {visit.billing.claimId} · {visit.billing.claimStatus || "SUBMITTED"}
                  </p>
                )}
                {editBilling && visit.stage === "CLAIM_SUBMITTED" && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-full border px-3 py-1.5 text-xs font-semibold"
                      onClick={() => void run(() => updateClaimStatus(visit.id, "ACCEPTED"))}
                    >
                      Mark accepted
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-full border border-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-600"
                      onClick={() => void run(() => updateClaimStatus(visit.id, "REJECTED"))}
                    >
                      Mark rejected
                    </button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {tab === "done" && (
            <Card>
              <CardHeader title="Done" subtitle="Visit closed" />
              <div className="space-y-2 px-5 pb-5 text-sm text-slate-600">
                <p>Checked in {formatTime(visit.checkedInAt)}</p>
                <p>Stage: {STAGE_META[visit.stage].label}</p>
                {visit.diagnosis && <p>Diagnosis: {visit.diagnosis}</p>}
                {visit.billing?.invoiceNumber && <p>Invoice {visit.billing.invoiceNumber}</p>}
                {visit.stage !== "COMPLETED" && (
                  <p className="text-slate-400">This visit is still in the pipeline.</p>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </RoleGuard>
  );
}

export default function ConsultationJourneyPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">Loading journey…</p>}>
      <JourneyInner />
    </Suspense>
  );
}
