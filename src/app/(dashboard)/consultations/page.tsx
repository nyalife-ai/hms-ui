"use client";

import { FlaskConical, Play, Plus, Save, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ConsultationClinicalForm } from "@/components/consultation-clinical-form";
import { ConsultationQuickViewModal } from "@/components/consultation-quick-view-modal";
import { ConsultationRowActions } from "@/components/consultation-row-actions";
import { RoleGuard } from "@/components/role-guard";
import { SearchablePicker } from "@/components/searchable-picker";
import { TriageSummary } from "@/components/triage-summary";
import { Avatar, Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { PaymentInfo, PipelineStepper, VisitQueueList, VitalsGrid } from "@/components/visit-flow";
import {
  useClinicalServices,
  useLabTests,
  useMedications,
} from "@/lib/catalog";
import {
  relatedLabsHref,
  relatedPrescriptionsHref,
} from "@/lib/clinical-links";
import {
  clinicalDraftKey,
  emptyClinicalRecord,
  mergeClinicalRecord,
  type ClinicalRecord,
} from "@/lib/clinical-record";
import {
  toOrderedItem,
  type OrderedClinicalItem,
} from "@/lib/clinical-service";
import { api } from "@/lib/api";
import type { VisitLabReport } from "@/lib/lab-types";
import { PRESCRIPTION_FREQUENCIES } from "@/lib/prescription-frequency";
import { priorityTone } from "@/lib/triage";
import {
  PIPELINE_TAB_IDS,
  useVisits,
  formatTime,
  type PrescriptionLine,
  type Visit,
} from "@/lib/visits";

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground-lighter focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

const DOCTOR_STAGES = ["WAITING_DOCTOR", "IN_CONSULTATION", "LAB_PENDING", "RESULTS_READY"] as const;
const ACTIVE_CONSULT_STAGES = ["IN_CONSULTATION", "LAB_PENDING", "RESULTS_READY"] as const;

function nextStopsForVisit(visit: {
  prescriptions?: PrescriptionLine[];
  pharmacy?: { dispensed?: boolean; prescriptionNumber?: string };
}) {
  const needsPharmacy =
    (visit.prescriptions?.length ?? 0) > 0 && !visit.pharmacy?.dispensed;
  const stops: string[] = [];
  if (needsPharmacy) stops.push("Pharmacy");
  stops.push("Billing");
  return stops;
}

function vitalsSummary(visit: Visit): string {
  const v = visit.vitals;
  if (!v) return "";
  return [
    v.temperature && `${v.temperature} °C`,
    (v.systolic || v.diastolic) && `${v.systolic}/${v.diastolic} mmHg`,
    v.pulse && `${v.pulse} bpm`,
    v.respRate && `RR ${v.respRate}`,
    v.spo2 && `SpO₂ ${v.spo2}%`,
    v.weightKg && `${v.weightKg} kg`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function loadInitialClinical(visit: Visit): {
  record: ClinicalRecord;
  draftNotice?: string;
} {
  const base = emptyClinicalRecord();
  const triageComplaint = visit.triage?.chiefComplaint?.trim();
  const triageReason = visit.triage?.reasonForVisit?.trim();
  if (triageComplaint && !visit.clinicalRecord?.chiefComplaint) {
    base.chiefComplaint = triageComplaint;
  } else if (
    !triageComplaint &&
    visit.reasonForVisit &&
    !visit.clinicalRecord?.chiefComplaint
  ) {
    base.chiefComplaint = visit.reasonForVisit;
  }
  if (visit.triage?.priority && !visit.clinicalRecord?.priority) {
    base.priority = visit.triage.priority;
  }
  // Reception admin notes stay separate; do not dump into doctor internal notes.
  if (visit.triage?.notes && !visit.clinicalRecord?.historyPresentIllness) {
    const symptomLines = (visit.triage.symptoms || [])
      .map((s) => {
        const bits = [
          s.symptom,
          s.severity?.toLowerCase(),
          s.durationValue
            ? `${s.durationValue} ${(s.durationUnit || "DAYS").toLowerCase()}`
            : null,
        ].filter(Boolean);
        return bits.join(" — ");
      })
      .filter(Boolean);
    base.historyPresentIllness = [
      triageReason ? `Reason for visit: ${triageReason}` : null,
      symptomLines.length ? `Reported symptoms:\n- ${symptomLines.join("\n- ")}` : null,
      visit.triage.notes ? `Triage notes: ${visit.triage.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  if (visit.diagnosis && !visit.clinicalRecord?.impression) {
    base.impression = visit.diagnosis;
  }
  if (visit.gender === "Female") {
    base.enableReproductiveContext = true;
  }

  const fromServer = mergeClinicalRecord(base, visit.clinicalRecord ?? null);

  try {
    const raw = localStorage.getItem(clinicalDraftKey(visit.id));
    if (raw) {
      const draft = JSON.parse(raw) as Partial<ClinicalRecord>;
      return {
        record: mergeClinicalRecord(fromServer, draft),
        draftNotice:
          "Draft restored. Your previous unsaved consultation data has been recovered.",
      };
    }
  } catch {
    // ignore corrupt drafts
  }

  return { record: fromServer };
}

function SelectedList({
  items,
  empty,
  onRemove,
}: {
  items: { id: string; label: string; meta?: string }[];
  empty: string;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="mt-2 text-xs text-foreground-lighter">{empty}</p>;
  }
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center justify-between gap-2 rounded-xl bg-surface-200 px-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{item.label}</p>
            {item.meta && (
              <p className="truncate text-[11px] text-foreground-lighter">{item.meta}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="shrink-0 rounded-lg p-1.5 text-foreground-muted hover:bg-white hover:text-rose-500"
            aria-label={`Remove ${item.label}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function ConsultationsPage() {
  const router = useRouter();
  const {
    visits,
    startConsultation,
    saveClinicalRecord,
    saveClinicalOrders,
    orderLabs,
    completeConsultation,
  } = useVisits();
  const { data: labTests } = useLabTests();
  const { data: medications } = useMedications();
  const { data: serviceCatalog } = useClinicalServices("service");
  const { data: surgeryCatalog } = useClinicalServices("surgery");

  const queue = visits.filter((v) => (DOCTOR_STAGES as readonly string[]).includes(v.stage));
  const dispatched = visits.filter((v) => v.stage === "READY_FOR_BILLING");
  const [selectedId, setSelectedId] = useState("");
  const selected = queue.find((v) => v.id === selectedId) ?? queue[0];
  const [quickView, setQuickView] = useState<Visit | null>(null);

  const [selectedLabs, setSelectedLabs] = useState<
    { name: string; unit: string; range: string }[]
  >([]);
  const [labNotes, setLabNotes] = useState("");
  const [orderedServices, setOrderedServices] = useState<OrderedClinicalItem[]>([]);
  const [orderedSurgeries, setOrderedSurgeries] = useState<OrderedClinicalItem[]>([]);
  const [clinical, setClinical] = useState<ClinicalRecord>(emptyClinicalRecord);
  const [draftNotice, setDraftNotice] = useState<string | undefined>();
  const [prescriptions, setPrescriptions] = useState<PrescriptionLine[]>([]);
  const [followUpDate, setFollowUpDate] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const hydratedVisitId = useRef<string | null>(null);
  const [labReport, setLabReport] = useState<VisitLabReport | null>(null);
  const [labReportLoading, setLabReportLoading] = useState(false);

  const inConsult =
    selected &&
    (ACTIVE_CONSULT_STAGES as readonly string[]).includes(selected.stage);
  const canDiagnose =
    selected &&
    (selected.stage === "IN_CONSULTATION" || selected.stage === "RESULTS_READY");
  const canOrderLabs = selected?.stage === "IN_CONSULTATION";

  useEffect(() => {
    if (!selected) {
      hydratedVisitId.current = null;
      return;
    }
    if (hydratedVisitId.current === selected.id) return;
    hydratedVisitId.current = selected.id;
    const { record, draftNotice: notice } = loadInitialClinical(selected);
    setClinical(record);
    setDraftNotice(notice);
    setSelectedLabs([]);
    setLabNotes("");
    setOrderedServices(selected.orderedServices ?? []);
    setOrderedSurgeries(selected.orderedSurgeries ?? []);
    setPrescriptions(
      (selected.prescriptions ?? []).map((p) => ({
        ...p,
        frequency: p.frequency || "OD",
      })),
    );
    setFollowUpDate(selected.followUpDate ?? "");
    setSaveMsg("");
  }, [selected]);

  useEffect(() => {
    if (!selected || !inConsult) return;
    const key = clinicalDraftKey(selected.id);
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(clinical));
      } catch {
        // quota / private mode
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [clinical, selected, inConsult]);

  useEffect(() => {
    if (
      !selected ||
      (selected.stage !== "LAB_PENDING" && selected.stage !== "RESULTS_READY")
    ) {
      setLabReport(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLabReportLoading(true);
      try {
        const report = await api<VisitLabReport>(
          `/laboratory/visit-report?visitId=${encodeURIComponent(selected.id)}`,
        );
        if (!cancelled) setLabReport(report);
      } catch {
        if (!cancelled) setLabReport(null);
      } finally {
        if (!cancelled) setLabReportLoading(false);
      }
    };
    void load();
    const poll = window.setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [selected]);

  const diagnosisText = useMemo(
    () => clinical.impression.trim() || selected?.diagnosis?.trim() || "",
    [clinical.impression, selected?.diagnosis],
  );

  const labOptions = useMemo(
    () =>
      labTests.map((t) => ({
        id: t.id || t.name,
        label: t.name,
        sublabel: [t.unit, t.range].filter(Boolean).join(" · ") || undefined,
        group: t.category ?? "Laboratory",
      })),
    [labTests],
  );

  const serviceOptions = useMemo(
    () =>
      serviceCatalog.map((s) => ({
        id: s.id,
        label: s.name,
        sublabel: `${s.code} · KES ${Number(s.standardPrice).toLocaleString()}`,
        group: s.category ?? "Services",
      })),
    [serviceCatalog],
  );

  const surgeryOptions = useMemo(
    () =>
      surgeryCatalog.map((s) => ({
        id: s.id,
        label: s.name,
        sublabel: `${s.code} · KES ${Number(s.standardPrice).toLocaleString()}`,
        group: s.category ?? "Surgery",
      })),
    [surgeryCatalog],
  );

  const medOptions = useMemo(
    () =>
      medications.map((m) => ({
        id: m.id,
        label: m.name,
        sublabel: `${m.category}${m.stock != null ? ` · stock ${m.stock}` : ""}`,
        group: m.category || "Medications",
      })),
    [medications],
  );

  const persistOrders = async () => {
    if (!selected || !inConsult) return;
    await saveClinicalOrders(selected.id, {
      orderedServices,
      orderedSurgeries,
    });
  };

  const sendLabOrder = async () => {
    if (!selected || selectedLabs.length === 0) return;
    await persistOrders().catch(() => undefined);
    await saveClinicalRecord(selected.id, clinical).catch(() => undefined);
    orderLabs(selected.id, selectedLabs, labNotes);
    setSelectedLabs([]);
    setLabNotes("");
  };

  const persistNotes = async () => {
    if (!selected || !inConsult) return;
    setSavingNotes(true);
    setSaveMsg("");
    try {
      await saveClinicalRecord(selected.id, clinical);
      await persistOrders();
      try {
        localStorage.removeItem(clinicalDraftKey(selected.id));
      } catch {
        // ignore
      }
      setDraftNotice(undefined);
      setSaveMsg("Clinical notes & orders saved.");
    } catch {
      setSaveMsg("Could not save — try again.");
    } finally {
      setSavingNotes(false);
    }
  };

  const finish = async () => {
    if (!selected || diagnosisText === "") return;
    await completeConsultation(selected.id, {
      diagnosis: diagnosisText,
      prescriptions: prescriptions.filter((p) => p.medication !== ""),
      followUpDate: followUpDate || undefined,
      clinicalRecord: clinical,
      orderedServices,
      orderedSurgeries,
    });
    try {
      localStorage.removeItem(clinicalDraftKey(selected.id));
    } catch {
      // ignore
    }
    setSelectedId("");
    hydratedVisitId.current = null;
  };

  const addPrescription = (med?: { id: string; label: string }) => {
    setPrescriptions([
      ...prescriptions,
      {
        medication: med?.label ?? "",
        medicationId: med?.id,
        dosage: "",
        frequency: "OD",
        duration: "",
        quantity: 1,
      },
    ]);
  };

  const updatePrescription = (i: number, patch: Partial<PrescriptionLine>) =>
    setPrescriptions(prescriptions.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const onClinicalChange = (next: ClinicalRecord) => {
    setClinical(next);
    setDraftNotice(undefined);
  };

  return (
    <RoleGuard module="consultations">
      <PageHeader
        title="Consultations"
        subtitle={`${queue.length} in your care · ${dispatched.length} sent onward today`}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.6fr]">
        <div className="space-y-4">
          <Card className="h-fit">
            <CardHeader
              title="My Queue"
              subtitle="Urgency first · oldest triage next within each level"
            />
            <VisitQueueList
              visits={queue}
              selectedId={selected?.id}
              onSelect={(id) => {
                setSelectedId(id);
                hydratedVisitId.current = null;
              }}
              emptyMessage="No patients in the queue. Triaged patients appear here."
              trailing={(v) => (
                <ConsultationRowActions
                  onQuickView={() => setQuickView(v)}
                  onEditRecord={() => router.push(`/consultations/${v.id}`)}
                  onRelatedLabs={() =>
                    router.push(
                      relatedLabsHref({
                        visitId: v.id,
                        appointmentId: v.appointmentId,
                        patientName: v.patientName,
                      }),
                    )
                  }
                  onRelatedPrescriptions={() =>
                    router.push(
                      relatedPrescriptionsHref({
                        visitId: v.id,
                        appointmentId: v.appointmentId,
                        patientName: v.patientName,
                      }),
                    )
                  }
                />
              )}
            />
          </Card>

          <Card className="h-fit">
            <CardHeader
              title="Dispatched today"
              subtitle="After you complete a consult they leave your queue — next desk is here"
            />
            {dispatched.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-foreground-lighter">
                No patients waiting at pharmacy or billing yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-50 px-2 pb-3">
                {dispatched.map((v) => {
                  const stops = nextStopsForVisit(v);
                  return (
                    <li
                      key={v.id}
                      className="flex items-start justify-between gap-3 px-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {v.patientName}
                        </p>
                        <p className="text-xs text-foreground-lighter">
                          {v.mrn}
                          {v.pharmacy?.prescriptionNumber
                            ? ` · Rx ${v.pharmacy.prescriptionNumber}`
                            : ""}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {stops.map((stop) => (
                            <Badge
                              key={stop}
                              tone={stop === "Pharmacy" ? "teal" : "amber"}
                            >
                              → {stop}
                            </Badge>
                          ))}
                          {v.pharmacy?.dispensed && (
                            <Badge tone="green">Pharmacy done</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-start gap-1">
                        <div className="flex flex-col items-end gap-1 text-[11px] text-foreground-lighter">
                          <span>Next desk</span>
                          <span className="font-medium text-foreground-light">
                            {stops.join(" → ")}
                          </span>
                        </div>
                        <ConsultationRowActions
                          onQuickView={() => setQuickView(v)}
                          onEditRecord={() => router.push(`/consultations/${v.id}`)}
                          onRelatedLabs={() =>
                            router.push(
                              relatedLabsHref({
                                visitId: v.id,
                                appointmentId: v.appointmentId,
                                patientName: v.patientName,
                              }),
                            )
                          }
                          onRelatedPrescriptions={() =>
                            router.push(
                              relatedPrescriptionsHref({
                                visitId: v.id,
                                appointmentId: v.appointmentId,
                                patientName: v.patientName,
                              }),
                            )
                          }
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        {selected ? (
          <div className="space-y-4">
            <Card>
              <CardHeader
                title={selected.patientName}
                subtitle={`${selected.mrn} · ${selected.age} yrs · ${selected.gender} · Triaged by ${selected.nurseName ?? "—"}`}
                action={
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/consultations/${selected.id}`}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-brand-300"
                    >
                      Journey
                    </Link>
                    <Avatar name={selected.patientName} />
                  </div>
                }
              />
              <div className="space-y-4 px-5 pb-5">
                <PipelineStepper
                  visit={selected}
                  onStepClick={(step) =>
                    router.push(
                      `/consultations/${selected.id}?tab=${PIPELINE_TAB_IDS[step - 1]}`,
                    )
                  }
                />
                <PaymentInfo visit={selected} />
                {(selected.triagePriority || selected.triage?.priority) && (
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={priorityTone(
                        selected.triagePriority || selected.triage?.priority,
                      )}
                    >
                      {selected.triagePriority || selected.triage?.priority}
                    </Badge>
                    {selected.triage?.priorityReason && (
                      <span className="text-xs text-foreground-light">
                        {selected.triage.priorityReason}
                      </span>
                    )}
                  </div>
                )}
                <TriageSummary visit={selected} />
                {!selected.triage && <VitalsGrid visit={selected} />}

                {selected.stage === "WAITING_DOCTOR" && (
                  <button
                    onClick={() => startConsultation(selected.id)}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
                  >
                    <Play className="h-4 w-4" /> Start Consultation
                  </button>
                )}
              </div>
            </Card>

            {inConsult && (
              <Card>
                <CardHeader
                  title="Record Consultation"
                  subtitle="Clinical narrative for this visit — saved with the patient record"
                  action={
                    <button
                      type="button"
                      onClick={() => void persistNotes()}
                      disabled={savingNotes}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-200 disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {savingNotes ? "Saving…" : "Save notes"}
                    </button>
                  }
                />
                <div className="px-5 pb-5">
                  {saveMsg && (
                    <p className="mb-3 text-xs text-foreground-light">{saveMsg}</p>
                  )}
                  <ConsultationClinicalForm
                    value={clinical}
                    onChange={onClinicalChange}
                    patientGender={selected.gender}
                    patientName={selected.patientName}
                    vitalsSummary={vitalsSummary(selected)}
                    draftNotice={draftNotice}
                  />
                </div>
              </Card>
            )}

            {selected.stage === "LAB_PENDING" && selected.labOrder && !(labReport?.released && labReport.lines.length > 0) && (
              <Card>
                <CardHeader title="Laboratory — awaiting results" subtitle="The lab technician has this request on their worklist" />
                <div className="px-5 pb-5">
                  <ul className="flex flex-wrap gap-2">
                    {selected.labOrder.tests.map((t) => (
                      <li key={t.name}>
                        <Badge tone="amber">{t.name}</Badge>
                      </li>
                    ))}
                  </ul>
                  {selected.labOrder.notes && (
                    <p className="mt-3 text-xs text-foreground-lighter">Notes to lab: {selected.labOrder.notes}</p>
                  )}
                  {labReportLoading && (
                    <p className="mt-3 text-xs text-foreground-lighter">Checking for released results…</p>
                  )}
                </div>
              </Card>
            )}

            {((selected.stage === "RESULTS_READY" || selected.stage === "LAB_PENDING") &&
              labReport &&
              labReport.released &&
              labReport.lines.length > 0) && (
              <Card>
                <CardHeader
                  title="Lab Report"
                  subtitle={
                    labReport.releasedAt
                      ? `Released ${formatTime(labReport.releasedAt)}`
                      : "Released from laboratory"
                  }
                  action={<Badge tone="teal">Results ready</Badge>}
                />
                <div className="px-5 pb-5">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-xs text-foreground-lighter">
                        <th className="pb-2 font-medium">Test</th>
                        <th className="pb-2 font-medium">Result</th>
                        <th className="pb-2 font-medium">Reference Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {labReport.lines.map((t) => (
                        <tr key={t.id} className="border-t border-border">
                          <td className="py-2.5 font-medium text-foreground">
                            {t.parameterName ?? t.testName ?? "—"}
                            {t.testName && t.parameterName ? (
                              <span className="block text-xs font-normal text-foreground-lighter">
                                {t.testName}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2.5 font-semibold text-brand-700">
                            {t.resultValue ?? "—"}
                            {t.unitOfMeasurement ? ` ${t.unitOfMeasurement}` : ""}
                          </td>
                          <td className="py-2.5 text-foreground-lighter">
                            {t.normalReferenceRange ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(labReport.observations || labReport.conclusion) && (
                    <p className="mt-3 rounded-xl bg-[#f3f7f7] px-3.5 py-2.5 text-xs text-foreground-light">
                      {[labReport.observations, labReport.conclusion]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  <Link
                    href={relatedLabsHref({
                      visitId: selected.id,
                      appointmentId: selected.appointmentId,
                      patientName: selected.patientName,
                    })}
                    className="mt-3 inline-flex text-xs font-semibold text-brand-700"
                  >
                    Open related labs →
                  </Link>
                </div>
              </Card>
            )}

            {selected.stage === "RESULTS_READY" &&
              !labReportLoading &&
              !(labReport?.released && (labReport.lines.length ?? 0) > 0) && (
              <Card>
                <CardHeader
                  title="Lab Report"
                  subtitle="Awaiting laboratory release"
                  action={<Badge tone="amber">Not released</Badge>}
                />
                <div className="px-5 pb-5">
                  <p className="text-sm text-foreground-light">
                    Results are not yet released to the consultation. Ask the laboratory
                    to use <span className="font-semibold">Send to Doctor</span> after
                    verification.
                  </p>
                  {selected.labOrder?.tests?.length ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {selected.labOrder.tests.map((t) => (
                        <li key={t.name}>
                          <Badge tone="slate">{t.name}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </Card>
            )}

            {inConsult && (
              <Card>
                <CardHeader
                  title="Additional services & diagnostics"
                  subtitle="Search to add — selected items are listed below. Labs go to the worklist; services & surgeries bill on completion."
                />
                <div className="grid grid-cols-1 gap-5 px-5 pb-5 lg:grid-cols-3">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-light">
                      Laboratory tests
                    </p>
                    <SearchablePicker
                      options={labOptions}
                      placeholder="Add more labs…"
                      disabled={!canOrderLabs}
                      excludeIds={selectedLabs.flatMap((t) => {
                        const match = labTests.find((x) => x.name === t.name);
                        return match ? [match.id, match.name] : [t.name];
                      })}
                      onSelect={(opt) => {
                        const t = labTests.find(
                          (x) => x.id === opt.id || x.name === opt.label,
                        );
                        if (!t) return;
                        if (selectedLabs.some((s) => s.name === t.name)) return;
                        setSelectedLabs([
                          ...selectedLabs,
                          { name: t.name, unit: t.unit, range: t.range },
                        ]);
                      }}
                    />
                    <SelectedList
                      items={selectedLabs.map((t) => ({
                        id: t.name,
                        label: t.name,
                        meta: [t.unit, t.range].filter(Boolean).join(" · "),
                      }))}
                      empty={
                        canOrderLabs
                          ? "No lab tests selected."
                          : "Lab ordering available while in consultation."
                      }
                      onRemove={(id) =>
                        setSelectedLabs(selectedLabs.filter((t) => t.name !== id))
                      }
                    />
                    {canOrderLabs && (
                      <div className="mt-3 space-y-2">
                        <input
                          className={inputClass}
                          value={labNotes}
                          onChange={(e) => setLabNotes(e.target.value)}
                          placeholder="Clinical notes for the lab (optional)"
                        />
                        <button
                          onClick={() => void sendLabOrder()}
                          disabled={selectedLabs.length === 0}
                          className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <FlaskConical className="h-3.5 w-3.5" /> Send to Laboratory
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-light">
                      Services & procedures
                    </p>
                    <SearchablePicker
                      options={serviceOptions}
                      placeholder="Add a service/procedure…"
                      excludeIds={orderedServices.map((s) => s.id)}
                      onSelect={(opt) => {
                        const s = serviceCatalog.find((x) => x.id === opt.id);
                        if (!s) return;
                        if (orderedServices.some((x) => x.id === s.id)) return;
                        setOrderedServices([...orderedServices, toOrderedItem(s)]);
                      }}
                      emptyMessage="No services in catalog — add under Laboratory → Services & Procedures"
                    />
                    <SelectedList
                      items={orderedServices.map((s) => ({
                        id: s.id,
                        label: s.name,
                        meta: `${s.category ?? s.code} · KES ${Number(s.unitPrice).toLocaleString()}`,
                      }))}
                      empty="No services selected."
                      onRemove={(id) =>
                        setOrderedServices(orderedServices.filter((s) => s.id !== id))
                      }
                    />
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-light">
                      Surgeries
                    </p>
                    <SearchablePicker
                      options={surgeryOptions}
                      placeholder="Add a surgery…"
                      excludeIds={orderedSurgeries.map((s) => s.id)}
                      onSelect={(opt) => {
                        const s = surgeryCatalog.find((x) => x.id === opt.id);
                        if (!s) return;
                        if (orderedSurgeries.some((x) => x.id === s.id)) return;
                        setOrderedSurgeries([...orderedSurgeries, toOrderedItem(s)]);
                      }}
                      emptyMessage="No surgeries in catalog — use category Surgery under Laboratory → Services"
                    />
                    <SelectedList
                      items={orderedSurgeries.map((s) => ({
                        id: s.id,
                        label: s.name,
                        meta: `KES ${Number(s.unitPrice).toLocaleString()}`,
                      }))}
                      empty="No surgeries selected."
                      onRemove={(id) =>
                        setOrderedSurgeries(orderedSurgeries.filter((s) => s.id !== id))
                      }
                    />
                  </div>
                </div>
                <p className="px-5 pb-5 text-[11px] text-foreground-lighter">
                  Selected services and surgeries are billed on the patient invoice when you complete the consultation.
                </p>
              </Card>
            )}

            {canDiagnose && (
              <Card>
                <CardHeader
                  title="Prescription & complete"
                  subtitle="Search medications · choose frequency (OD / BD / TDS / QDS / PRN / STAT)"
                />
                <div className="space-y-4 px-5 pb-5">
                  <div className="rounded-xl bg-surface-200 px-3.5 py-2.5 text-sm text-foreground-light">
                    <p className="text-xs font-semibold text-foreground-light">Diagnosis for completion</p>
                    <p className="mt-1 whitespace-pre-wrap">
                      {diagnosisText || "Add an impression / diagnosis in the clinical form above."}
                    </p>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-foreground-light">Prescriptions</label>
                      <button
                        type="button"
                        onClick={() => addPrescription()}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        <Plus className="h-3.5 w-3.5" /> Blank row
                      </button>
                    </div>
                    <SearchablePicker
                      options={medOptions}
                      placeholder="Search medications…"
                      onSelect={(opt) => addPrescription({ id: opt.id, label: opt.label })}
                    />
                    {prescriptions.length === 0 && (
                      <p className="mt-2 text-xs text-foreground-lighter">No medication added — optional.</p>
                    )}
                    <div className="mt-2 space-y-2">
                      {prescriptions.map((p, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-1 gap-2 rounded-xl bg-[#f3f7f7] p-3 sm:grid-cols-[1.4fr_1fr_1.1fr_1fr_0.7fr_auto]"
                        >
                          <input
                            className={inputClass}
                            value={p.medication}
                            onChange={(e) =>
                              updatePrescription(i, {
                                medication: e.target.value,
                                medicationId: undefined,
                              })
                            }
                            placeholder="Medication"
                            aria-label="Medication"
                          />
                          <input
                            className={inputClass}
                            value={p.dosage}
                            onChange={(e) => updatePrescription(i, { dosage: e.target.value })}
                            placeholder="Dose e.g. 1 tab"
                            aria-label="Dose"
                          />
                          <select
                            className={inputClass}
                            value={p.frequency || "OD"}
                            onChange={(e) =>
                              updatePrescription(i, { frequency: e.target.value })
                            }
                            aria-label="Frequency"
                          >
                            {PRESCRIPTION_FREQUENCIES.map((f) => (
                              <option key={f.value} value={f.value}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                          <input
                            className={inputClass}
                            value={p.duration}
                            onChange={(e) => updatePrescription(i, { duration: e.target.value })}
                            placeholder="Duration e.g. 5 days"
                            aria-label="Duration"
                          />
                          <input
                            className={inputClass}
                            type="number"
                            min={1}
                            value={p.quantity ?? 1}
                            onChange={(e) =>
                              updatePrescription(i, { quantity: Math.max(1, Number(e.target.value) || 1) })
                            }
                            placeholder="Qty"
                            aria-label="Quantity to dispense"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setPrescriptions(prescriptions.filter((_, idx) => idx !== i))
                            }
                            className="self-center rounded-lg p-2 text-foreground-muted hover:bg-white hover:text-rose-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground-light">Follow-up date (optional)</label>
                    <input
                      type="date"
                      className={`mt-1.5 ${inputClass} sm:max-w-56`}
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                    />
                  </div>

                  <button
                    onClick={() => void finish()}
                    disabled={diagnosisText === ""}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />{" "}
                    {prescriptions.some((p) => p.medication)
                      ? "Complete — send to Pharmacy & Billing"
                      : "Complete & Send to Billing"}
                  </button>
                  <p className="text-center text-[11px] text-foreground-lighter">
                    Labs already sent stay on the lab desk. Services, surgeries, and meds bill on completion.
                  </p>
                </div>
              </Card>
            )}
          </div>
        ) : (
          <Card className="flex min-h-64 items-center justify-center p-10 text-sm text-foreground-lighter">
            Select a patient from your queue to begin.
          </Card>
        )}
      </div>
      {quickView && (
        <ConsultationQuickViewModal
          visit={quickView}
          onClose={() => setQuickView(null)}
        />
      )}
    </RoleGuard>
  );
}
