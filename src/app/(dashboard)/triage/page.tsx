"use client";

import { Loader2, Plus, RefreshCw, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DoctorSearchSelect } from "@/components/doctor-search-select";
import { FieldLabel } from "@/components/field-label";
import { RoleGuard } from "@/components/role-guard";
import { Avatar, Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { PaymentInfo, PipelineStepper, VisitQueueList } from "@/components/visit-flow";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  calcBmi,
  priorityTone,
  type SymptomCatalogueResponse,
  type TriagePriority,
  type TriageSymptom,
  type TriageSubmitPayload,
} from "@/lib/triage";
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
  heightCm: "",
  painScore: "",
  painLocation: "",
  bloodGlucose: "",
  bloodGlucoseContext: undefined,
  headCircumferenceCm: "",
  muacCm: "",
};

const CORE_VITALS: (keyof Vitals)[] = [
  "temperature",
  "systolic",
  "diastolic",
  "pulse",
  "respRate",
  "spo2",
  "weightKg",
];

function emptySymptom(): TriageSymptom {
  return {
    symptomId: "",
    symptom: "",
    onset: undefined,
    durationValue: "",
    durationUnit: "DAYS",
    severity: undefined,
    progression: undefined,
    associatedSymptoms: "",
    notes: "",
  };
}

export default function TriagePage() {
  const { user } = useAuth();
  const { visits, loading, refresh, recordTriage } = useVisits();
  const [catalogue, setCatalogue] = useState<SymptomCatalogueResponse | null>(null);

  const queue = useMemo(
    () =>
      visits
        .filter((v) => v.stage === "CHECKED_IN")
        .slice()
        .sort(
          (a, b) =>
            new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime(),
        ),
    [visits],
  );
  const atFinance = useMemo(
    () => visits.filter((v) => v.stage === "AWAITING_PAYMENT"),
    [visits],
  );

  const [selectedId, setSelectedId] = useState("");
  const [vitals, setVitals] = useState<Vitals>(EMPTY_VITALS);
  const [doctorStaffId, setDoctorStaffId] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [reasonForVisit, setReasonForVisit] = useState("");
  const [reasonOther, setReasonOther] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [symptoms, setSymptoms] = useState<TriageSymptom[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [conditionsOther, setConditionsOther] = useState("");
  const [medications, setMedications] = useState("");
  const [allergiesKnown, setAllergiesKnown] = useState<boolean | null>(null);
  const [allergens, setAllergens] = useState("");
  const [allergyReaction, setAllergyReaction] = useState("");
  const [surgicalHistory, setSurgicalHistory] = useState("");
  const [contexts, setContexts] = useState<string[]>([]);
  const [antenatal, setAntenatal] = useState<Record<string, string>>({});
  const [gyn, setGyn] = useState<Record<string, string>>({});
  const [paediatric, setPaediatric] = useState<Record<string, string>>({});
  const [chronic, setChronic] = useState<Record<string, string>>({});
  const [appearance, setAppearance] = useState("");
  const [mentalStatus, setMentalStatus] = useState("");
  const [mobility, setMobility] = useState("");
  const [respEffort, setRespEffort] = useState("");
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [triageNotes, setTriageNotes] = useState("");
  const [priority, setPriority] = useState<TriagePriority>("NORMAL");
  const [priorityReason, setPriorityReason] = useState("");
  const [disposition, setDisposition] = useState("SEND_TO_DOCTOR");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    void api<SymptomCatalogueResponse>("/visits/symptom-catalogue")
      .then(setCatalogue)
      .catch(() => setCatalogue(null));
  }, []);

  const selected = queue.find((v) => v.id === selectedId) ?? queue[0];

  useEffect(() => {
    if (!selected) return;
    setReasonForVisit("");
    setChiefComplaint(selected.reasonForVisit || "");
    setVitals(EMPTY_VITALS);
    setSymptoms([]);
    setPriority("NORMAL");
    setPriorityReason("");
    setTriageNotes("");
    setContexts([]);
    if (selected.age < 18) setContexts((c) => (c.includes("PAEDIATRIC") ? c : [...c, "PAEDIATRIC"]));
    if (selected.gender === "Female") {
      /* suggest only — do not auto-enable sensitive sections */
    }
  }, [selected?.id]);

  const bmi = useMemo(
    () => calcBmi(vitals.heightCm || "", vitals.weightKg || ""),
    [vitals.heightCm, vitals.weightKg],
  );

  const coreVitalsComplete = CORE_VITALS.every((k) => String(vitals[k] || "").trim());
  const doctorReady = Boolean(doctorStaffId && doctorName);
  const clinicalReady =
    reasonForVisit.trim() &&
    chiefComplaint.trim() &&
    (priority === "NORMAL" || priorityReason.trim());

  const computeWarnings = useCallback(() => {
    const w: string[] = [];
    const n = (s?: string) => Number(String(s || "").trim());
    const t = n(vitals.temperature);
    if (t && (t < 35 || t > 39.5)) w.push("Temperature outside usual range");
    const sys = n(vitals.systolic);
    if (sys && (sys < 90 || sys > 180)) w.push("Systolic BP unusual");
    const spo2 = n(vitals.spo2);
    if (spo2 && spo2 < 92) w.push("SpO₂ is low — consider urgency");
    const pulse = n(vitals.pulse);
    if (pulse && (pulse < 50 || pulse > 120)) w.push("Pulse unusual for adult outpatient");
    setWarnings(w);
  }, [vitals]);

  useEffect(() => {
    computeWarnings();
  }, [computeWarnings]);

  const resetForm = () => {
    setVitals(EMPTY_VITALS);
    setDoctorStaffId("");
    setDoctorName("");
    setReasonForVisit("");
    setReasonOther("");
    setChiefComplaint("");
    setSymptoms([]);
    setConditions([]);
    setConditionsOther("");
    setMedications("");
    setAllergiesKnown(null);
    setAllergens("");
    setAllergyReaction("");
    setSurgicalHistory("");
    setContexts([]);
    setAntenatal({});
    setGyn({});
    setPaediatric({});
    setChronic({});
    setAppearance("");
    setMentalStatus("");
    setMobility("");
    setRespEffort("");
    setRedFlags([]);
    setTriageNotes("");
    setPriority("NORMAL");
    setPriorityReason("");
    setDisposition("SEND_TO_DOCTOR");
    setSelectedId("");
  };

  const submit = async () => {
    if (!selected || !coreVitalsComplete || !doctorReady || !clinicalReady || !user) {
      setError("Complete required vitals, clinical intake, priority reason (if urgent), and doctor.");
      return;
    }
    setSubmitBusy(true);
    setError("");
    try {
      const payload: TriageSubmitPayload = {
        vitals: {
          temperature: vitals.temperature,
          systolic: vitals.systolic,
          diastolic: vitals.diastolic,
          pulse: vitals.pulse,
          respRate: vitals.respRate,
          spo2: vitals.spo2,
          weightKg: vitals.weightKg,
          heightCm: vitals.heightCm || undefined,
          painScore: vitals.painScore || undefined,
          painLocation: vitals.painLocation || undefined,
          bloodGlucose: vitals.bloodGlucose || undefined,
          bloodGlucoseContext: vitals.bloodGlucoseContext,
          headCircumferenceCm: vitals.headCircumferenceCm || undefined,
          muacCm: vitals.muacCm || undefined,
        },
        doctorName,
        doctorStaffId,
        nurseName: user.name,
        reasonForVisit,
        reasonForVisitOther: reasonOther || undefined,
        chiefComplaint,
        symptoms: symptoms.filter((s) => s.symptom.trim()),
        relevantHistory: {
          conditions,
          conditionsOther: conditionsOther || undefined,
          currentMedications: medications || undefined,
          allergiesKnown:
            allergiesKnown === null ? undefined : allergiesKnown,
          allergens: allergens || undefined,
          allergyReaction: allergyReaction || undefined,
          surgicalHistory: surgicalHistory || undefined,
        },
        contextsEnabled: contexts,
        antenatal: contexts.includes("ANTENATAL") ? antenatal : undefined,
        gynaecological: contexts.includes("GYNAECOLOGICAL") ? gyn : undefined,
        paediatric: contexts.includes("PAEDIATRIC") ? paediatric : undefined,
        chronic: contexts.includes("CHRONIC") ? chronic : undefined,
        assessment: {
          generalAppearance: appearance || undefined,
          mentalStatus: mentalStatus || undefined,
          mobility: mobility || undefined,
          respiratoryEffort: respEffort || undefined,
          redFlags,
        },
        notes: triageNotes || undefined,
        priority,
        priorityReason: priorityReason || undefined,
        disposition,
      };
      await recordTriage(selected.id, payload);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete triage");
    } finally {
      setSubmitBusy(false);
    }
  };

  const toggle = (list: string[], value: string, set: (v: string[]) => void) => {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const section = (title: string, children: React.ReactNode) => (
    <Card className="mb-4">
      <CardHeader title={title} />
      <div className="space-y-3 px-5 pb-5">{children}</div>
    </Card>
  );

  return (
    <RoleGuard module="triage">
      <PageHeader
        title="Triage"
        subtitle={`${queue.length} ready · ${atFinance.length} at finance · clinical intake before doctor`}
        action={
          <button
            type="button"
            onClick={() => {
              setRefreshBusy(true);
              void refresh().finally(() => setRefreshBusy(false));
            }}
            disabled={refreshBusy || loading}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-brand-300 disabled:opacity-50"
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

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Waiting for triage" subtitle="Oldest check-in first" />
            <VisitQueueList
              visits={queue}
              selectedId={selected?.id}
              onSelect={setSelectedId}
              emptyMessage="No patients waiting for triage"
            />
          </Card>
          {atFinance.length > 0 && (
            <Card>
              <CardHeader title="Still at finance" subtitle="Unpaid consult fee" />
              <VisitQueueList
                visits={atFinance}
                onSelect={() => undefined}
                emptyMessage=""
              />
            </Card>
          )}
        </div>

        <div>
          {!selected ? (
            <Card className="p-8 text-center text-sm text-slate-400">
              Select a patient to begin clinical triage intake
            </Card>
          ) : (
            <>
              <Card className="mb-4 p-5">
                <div className="flex items-start gap-3">
                  <Avatar name={selected.patientName} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{selected.patientName}</p>
                    <p className="text-xs text-slate-500">
                      {selected.mrn} · {selected.age} yrs · {selected.gender}
                    </p>
                    {(selected.reasonForVisit || selected.additionalNotes) && (
                      <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        {selected.reasonForVisit && (
                          <p>
                            <span className="font-medium">Reception context: </span>
                            {selected.reasonForVisit}
                          </p>
                        )}
                        {selected.additionalNotes && (
                          <p className="mt-1">
                            <span className="font-medium">Admin notes: </span>
                            {selected.additionalNotes}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="mt-3">
                      <PipelineStepper visit={selected} />
                    </div>
                    <div className="mt-3">
                      <PaymentInfo visit={selected} />
                    </div>
                  </div>
                </div>
              </Card>

              {section(
                "1. Patient & visit",
                <>
                  <div>
                    <FieldLabel required>Reason for visit</FieldLabel>
                    <select
                      className={inputClass}
                      value={reasonForVisit}
                      onChange={(e) => setReasonForVisit(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {(catalogue?.reasonOptions || []).map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    {reasonForVisit === "Other" && (
                      <input
                        className={`mt-2 ${inputClass}`}
                        placeholder="Describe other reason…"
                        value={reasonOther}
                        onChange={(e) => setReasonOther(e.target.value)}
                      />
                    )}
                  </div>
                  <div>
                    <FieldLabel required>Chief complaint (presenting)</FieldLabel>
                    <input
                      className={inputClass}
                      value={chiefComplaint}
                      onChange={(e) => setChiefComplaint(e.target.value)}
                      placeholder="Short presenting complaint — not a diagnosis"
                    />
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <FieldLabel>Reported symptoms</FieldLabel>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700"
                        onClick={() => setSymptoms((s) => [...s, emptySymptom()])}
                      >
                        <Plus className="h-3.5 w-3.5" /> Add symptom
                      </button>
                    </div>
                    {symptoms.length === 0 && (
                      <p className="text-xs text-slate-400">No symptoms recorded yet</p>
                    )}
                    <div className="space-y-3">
                      {symptoms.map((s, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-slate-100 p-3 space-y-2"
                        >
                          <div className="flex gap-2">
                            <select
                              className={inputClass}
                              value={s.symptomId}
                              onChange={(e) => {
                                const item = catalogue?.symptoms.find(
                                  (x) => x.id === e.target.value,
                                );
                                setSymptoms((rows) =>
                                  rows.map((row, i) =>
                                    i === idx
                                      ? {
                                          ...row,
                                          symptomId: e.target.value,
                                          symptom: item?.label || "",
                                          category: item?.category,
                                        }
                                      : row,
                                  ),
                                );
                              }}
                            >
                              <option value="">Select symptom…</option>
                              {(catalogue?.symptoms || []).map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.category}: {item.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"
                              onClick={() =>
                                setSymptoms((rows) => rows.filter((_, i) => i !== idx))
                              }
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <select
                              className={inputClass}
                              value={s.onset || ""}
                              onChange={(e) =>
                                setSymptoms((rows) =>
                                  rows.map((row, i) =>
                                    i === idx
                                      ? {
                                          ...row,
                                          onset: (e.target.value || undefined) as TriageSymptom["onset"],
                                        }
                                      : row,
                                  ),
                                )
                              }
                            >
                              <option value="">Onset</option>
                              <option value="SUDDEN">Sudden</option>
                              <option value="GRADUAL">Gradual</option>
                              <option value="UNKNOWN">Unknown</option>
                            </select>
                            <input
                              className={inputClass}
                              placeholder="Duration"
                              value={s.durationValue || ""}
                              onChange={(e) =>
                                setSymptoms((rows) =>
                                  rows.map((row, i) =>
                                    i === idx
                                      ? { ...row, durationValue: e.target.value }
                                      : row,
                                  ),
                                )
                              }
                            />
                            <select
                              className={inputClass}
                              value={s.durationUnit || "DAYS"}
                              onChange={(e) =>
                                setSymptoms((rows) =>
                                  rows.map((row, i) =>
                                    i === idx
                                      ? {
                                          ...row,
                                          durationUnit: e.target
                                            .value as TriageSymptom["durationUnit"],
                                        }
                                      : row,
                                  ),
                                )
                              }
                            >
                              <option value="HOURS">Hours</option>
                              <option value="DAYS">Days</option>
                              <option value="WEEKS">Weeks</option>
                              <option value="MONTHS">Months</option>
                              <option value="YEARS">Years</option>
                            </select>
                            <select
                              className={inputClass}
                              value={s.severity || ""}
                              onChange={(e) =>
                                setSymptoms((rows) =>
                                  rows.map((row, i) =>
                                    i === idx
                                      ? {
                                          ...row,
                                          severity: (e.target.value ||
                                            undefined) as TriageSymptom["severity"],
                                        }
                                      : row,
                                  ),
                                )
                              }
                            >
                              <option value="">Severity</option>
                              <option value="MILD">Mild</option>
                              <option value="MODERATE">Moderate</option>
                              <option value="SEVERE">Severe</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <select
                              className={inputClass}
                              value={s.progression || ""}
                              onChange={(e) =>
                                setSymptoms((rows) =>
                                  rows.map((row, i) =>
                                    i === idx
                                      ? {
                                          ...row,
                                          progression: (e.target.value ||
                                            undefined) as TriageSymptom["progression"],
                                        }
                                      : row,
                                  ),
                                )
                              }
                            >
                              <option value="">Progression</option>
                              <option value="IMPROVING">Improving</option>
                              <option value="STABLE">Stable</option>
                              <option value="WORSENING">Worsening</option>
                              <option value="UNKNOWN">Unknown</option>
                            </select>
                            <input
                              className={inputClass}
                              placeholder="Associated symptoms"
                              value={s.associatedSymptoms || ""}
                              onChange={(e) =>
                                setSymptoms((rows) =>
                                  rows.map((row, i) =>
                                    i === idx
                                      ? { ...row, associatedSymptoms: e.target.value }
                                      : row,
                                  ),
                                )
                              }
                            />
                          </div>
                          <input
                            className={inputClass}
                            placeholder="Symptom notes"
                            value={s.notes || ""}
                            onChange={(e) =>
                              setSymptoms((rows) =>
                                rows.map((row, i) =>
                                  i === idx ? { ...row, notes: e.target.value } : row,
                                ),
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>,
              )}

              {section(
                "2. Vital signs",
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {(
                      [
                        ["temperature", "Temperature °C *"],
                        ["systolic", "BP Systolic *"],
                        ["diastolic", "BP Diastolic *"],
                        ["pulse", "Pulse bpm *"],
                        ["respRate", "Resp. Rate /min *"],
                        ["spo2", "SpO₂ % *"],
                        ["weightKg", "Weight kg *"],
                        ["heightCm", "Height cm"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key}>
                        <FieldLabel>{label}</FieldLabel>
                        <input
                          className={inputClass}
                          placeholder={
                            (
                              {
                                temperature: "e.g. 37.0",
                                systolic: "e.g. 120",
                                diastolic: "e.g. 80",
                                pulse: "e.g. 72",
                                respRate: "e.g. 16",
                                spo2: "e.g. 98",
                                weightKg: "e.g. 70",
                                heightCm: "e.g. 170",
                              } as Record<string, string>
                            )[key]
                          }
                          value={String(vitals[key] || "")}
                          onChange={(e) =>
                            setVitals((v) => ({ ...v, [key]: e.target.value }))
                          }
                        />
                      </div>
                    ))}
                    <div>
                      <FieldLabel>BMI (calculated)</FieldLabel>
                      <input className={inputClass} value={bmi} readOnly placeholder="—" />
                    </div>
                    <div>
                      <FieldLabel>Pain score 0–10</FieldLabel>
                      <input
                        className={inputClass}
                        placeholder="e.g. 3"
                        value={vitals.painScore || ""}
                        onChange={(e) =>
                          setVitals((v) => ({ ...v, painScore: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <FieldLabel>Pain location</FieldLabel>
                      <input
                        className={inputClass}
                        placeholder="e.g. Lower back"
                        value={vitals.painLocation || ""}
                        onChange={(e) =>
                          setVitals((v) => ({ ...v, painLocation: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <FieldLabel>Blood glucose</FieldLabel>
                      <input
                        className={inputClass}
                        placeholder="e.g. 5.4"
                        value={vitals.bloodGlucose || ""}
                        onChange={(e) =>
                          setVitals((v) => ({ ...v, bloodGlucose: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <FieldLabel>Glucose context</FieldLabel>
                      <select
                        className={inputClass}
                        value={vitals.bloodGlucoseContext || ""}
                        onChange={(e) =>
                          setVitals((v) => ({
                            ...v,
                            bloodGlucoseContext: (e.target.value ||
                              undefined) as Vitals["bloodGlucoseContext"],
                          }))
                        }
                      >
                        <option value="">—</option>
                        <option value="RANDOM">Random</option>
                        <option value="FASTING">Fasting</option>
                        <option value="OTHER">Other</option>
                        <option value="UNKNOWN">Unknown</option>
                      </select>
                    </div>
                    {contexts.includes("PAEDIATRIC") && (
                      <>
                        <div>
                          <FieldLabel>Head circumference cm</FieldLabel>
                          <input
                            className={inputClass}
                            value={vitals.headCircumferenceCm || ""}
                            onChange={(e) =>
                              setVitals((v) => ({
                                ...v,
                                headCircumferenceCm: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <FieldLabel>MUAC cm</FieldLabel>
                          <input
                            className={inputClass}
                            value={vitals.muacCm || ""}
                            onChange={(e) =>
                              setVitals((v) => ({ ...v, muacCm: e.target.value }))
                            }
                          />
                        </div>
                      </>
                    )}
                  </div>
                  {warnings.length > 0 && (
                    <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {warnings.map((w) => (
                        <p key={w}>{w}</p>
                      ))}
                    </div>
                  )}
                </>,
              )}

              {section(
                "3. Relevant history",
                <>
                  <p className="text-xs text-slate-400">
                    Triage-level known history only — full medical history remains on the doctor form.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(catalogue?.conditions || []).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggle(conditions, c, setConditions)}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          conditions.includes(c)
                            ? "border-brand-300 bg-brand-50 text-brand-800"
                            : "border-slate-200 text-slate-600"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  {conditions.includes("Other") && (
                    <input
                      className={inputClass}
                      placeholder="Other conditions"
                      value={conditionsOther}
                      onChange={(e) => setConditionsOther(e.target.value)}
                    />
                  )}
                  <div>
                    <FieldLabel>Current medications</FieldLabel>
                    <textarea
                      className={inputClass}
                      rows={2}
                      value={medications}
                      onChange={(e) => setMedications(e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel>Allergies</FieldLabel>
                    <div className="mt-1 flex gap-2">
                      <button
                        type="button"
                        className={`rounded-full border px-3 py-1 text-xs ${
                          allergiesKnown === false
                            ? "border-brand-300 bg-brand-50"
                            : "border-slate-200"
                        }`}
                        onClick={() => setAllergiesKnown(false)}
                      >
                        No known allergies
                      </button>
                      <button
                        type="button"
                        className={`rounded-full border px-3 py-1 text-xs ${
                          allergiesKnown === true
                            ? "border-brand-300 bg-brand-50"
                            : "border-slate-200"
                        }`}
                        onClick={() => setAllergiesKnown(true)}
                      >
                        Known allergy
                      </button>
                    </div>
                    {allergiesKnown && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input
                          className={inputClass}
                          placeholder="Allergen"
                          value={allergens}
                          onChange={(e) => setAllergens(e.target.value)}
                        />
                        <input
                          className={inputClass}
                          placeholder="Reaction"
                          value={allergyReaction}
                          onChange={(e) => setAllergyReaction(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <FieldLabel>Surgical history (if relevant)</FieldLabel>
                    <input
                      className={inputClass}
                      value={surgicalHistory}
                      onChange={(e) => setSurgicalHistory(e.target.value)}
                    />
                  </div>
                </>,
              )}

              {section(
                "4. Context-specific screening",
                <>
                  <p className="text-xs text-slate-400">
                    Enable only when clinically relevant — do not open every section by default.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["ANTENATAL", "Antenatal / pregnancy"],
                        ["PAEDIATRIC", "Paediatric"],
                        ["GYNAECOLOGICAL", "Gynaecological / reproductive"],
                        ["CHRONIC", "Chronic disease"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggle(contexts, id, setContexts)}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          contexts.includes(id)
                            ? "border-brand-300 bg-brand-50 text-brand-800"
                            : "border-slate-200 text-slate-600"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {contexts.includes("ANTENATAL") && (
                    <div className="grid gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-2">
                      {(
                        [
                          ["pregnancyStatus", "Pregnancy status"],
                          ["lmp", "LMP"],
                          ["gestationalAgeWeeks", "Gestational age (weeks)"],
                          ["edd", "EDD"],
                          ["gravida", "Gravida"],
                          ["para", "Para"],
                          ["currentConcerns", "Current pregnancy concerns"],
                          ["fetalHeartRate", "Fetal heart rate"],
                          ["fundalHeightCm", "Fundal height cm"],
                        ] as const
                      ).map(([k, label]) => (
                        <div key={k}>
                          <FieldLabel>{label}</FieldLabel>
                          <input
                            className={inputClass}
                            value={antenatal[k] || ""}
                            onChange={(e) =>
                              setAntenatal((a) => ({ ...a, [k]: e.target.value }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {contexts.includes("GYNAECOLOGICAL") && (
                    <div className="grid gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-2">
                      {(
                        [
                          ["pregnancyStatus", "Pregnancy status"],
                          ["lmp", "LMP"],
                          ["menstrualConcern", "Menstrual concern"],
                          ["otherConcern", "Other reproductive concern"],
                        ] as const
                      ).map(([k, label]) => (
                        <div key={k}>
                          <FieldLabel>{label}</FieldLabel>
                          <input
                            className={inputClass}
                            value={gyn[k] || ""}
                            onChange={(e) =>
                              setGyn((a) => ({ ...a, [k]: e.target.value }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {contexts.includes("PAEDIATRIC") && (
                    <div className="grid gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-2">
                      {(
                        [
                          ["feedingConcerns", "Feeding concerns"],
                          ["developmentalConcerns", "Developmental concerns"],
                          ["vaccinationNotes", "Vaccination notes"],
                          ["otherConcerns", "Other paediatric concerns"],
                        ] as const
                      ).map(([k, label]) => (
                        <div key={k}>
                          <FieldLabel>{label}</FieldLabel>
                          <input
                            className={inputClass}
                            value={paediatric[k] || ""}
                            onChange={(e) =>
                              setPaediatric((a) => ({ ...a, [k]: e.target.value }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {contexts.includes("CHRONIC") && (
                    <div className="grid gap-2 rounded-xl border border-slate-100 p-3">
                      <div>
                        <FieldLabel>Relevant chronic symptoms</FieldLabel>
                        <input
                          className={inputClass}
                          value={chronic.relevantSymptoms || ""}
                          onChange={(e) =>
                            setChronic((a) => ({
                              ...a,
                              relevantSymptoms: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <FieldLabel>Current treatment</FieldLabel>
                        <input
                          className={inputClass}
                          value={chronic.currentTreatment || ""}
                          onChange={(e) =>
                            setChronic((a) => ({
                              ...a,
                              currentTreatment: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </>,
              )}

              {section(
                "5. Triage assessment",
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        [
                          "General appearance",
                          appearance,
                          setAppearance,
                          ["Well appearing", "Stable", "Unwell", "Acutely unwell", "Distressed"],
                        ],
                        [
                          "Mental status",
                          mentalStatus,
                          setMentalStatus,
                          ["Alert", "Confused", "Drowsy", "Reduced responsiveness", "Other"],
                        ],
                        [
                          "Mobility",
                          mobility,
                          setMobility,
                          ["Ambulatory", "Requires assistance", "Wheelchair", "Bedbound", "Other"],
                        ],
                        [
                          "Respiratory effort",
                          respEffort,
                          setRespEffort,
                          ["Normal", "Increased", "Laboured"],
                        ],
                      ] as const
                    ).map(([label, value, set, opts]) => (
                      <div key={label}>
                        <FieldLabel>{label}</FieldLabel>
                        <select
                          className={inputClass}
                          value={value}
                          onChange={(e) => set(e.target.value)}
                        >
                          <option value="">—</option>
                          {opts.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div>
                    <FieldLabel>Red flags</FieldLabel>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {(catalogue?.redFlags || []).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => toggle(redFlags, f, setRedFlags)}
                          className={`rounded-full border px-3 py-1 text-xs ${
                            redFlags.includes(f)
                              ? "border-rose-300 bg-rose-50 text-rose-800"
                              : "border-slate-200 text-slate-600"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Clinical triage notes</FieldLabel>
                    <textarea
                      className={inputClass}
                      rows={3}
                      value={triageNotes}
                      onChange={(e) => setTriageNotes(e.target.value)}
                      placeholder="Observations and triage findings — not a diagnosis"
                    />
                  </div>
                </>,
              )}

              {section(
                "6. Urgency & disposition",
                <>
                  <div>
                    <FieldLabel required>Priority</FieldLabel>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {(["NORMAL", "URGENT", "EMERGENCY"] as TriagePriority[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                            priority === p
                              ? "border-brand-400 bg-brand-50 text-brand-800"
                              : "border-slate-200 text-slate-600"
                          }`}
                        >
                          <Badge tone={priorityTone(p)}>{p}</Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                  {(priority === "URGENT" || priority === "EMERGENCY") && (
                    <div>
                      <FieldLabel required>Priority reason</FieldLabel>
                      <input
                        className={inputClass}
                        value={priorityReason}
                        onChange={(e) => setPriorityReason(e.target.value)}
                        placeholder="Why this urgency?"
                      />
                    </div>
                  )}
                  <div>
                    <FieldLabel>Disposition</FieldLabel>
                    <select
                      className={inputClass}
                      value={disposition}
                      onChange={(e) => setDisposition(e.target.value)}
                    >
                      <option value="SEND_TO_DOCTOR">Send to doctor</option>
                      <option value="OBSERVE">Observe</option>
                      <option value="REFER_EMERGENCY">Refer emergency</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <FieldLabel required>Assign to doctor</FieldLabel>
                    <DoctorSearchSelect
                      value={doctorStaffId}
                      onChange={(id, doctor) => {
                        setDoctorStaffId(id);
                        setDoctorName(doctor?.name || "");
                      }}
                    />
                  </div>
                </>,
              )}

              {error && <p className="mb-3 text-sm text-rose-500">{error}</p>}

              <button
                type="button"
                disabled={
                  submitBusy ||
                  !coreVitalsComplete ||
                  !doctorReady ||
                  !clinicalReady
                }
                onClick={() => void submit()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitBusy ? "Sending…" : "Complete triage & send to doctor"}
              </button>
            </>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
