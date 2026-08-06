"use client";

import { FlaskConical, Play, Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import { Avatar, Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { PaymentInfo, PipelineStepper, VisitQueueList, VitalsGrid } from "@/components/visit-flow";
import { useLabTests, useMedications } from "@/lib/catalog";
import { useVisits, formatTime, type PrescriptionLine } from "@/lib/visits";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

const DOCTOR_STAGES = ["WAITING_DOCTOR", "IN_CONSULTATION", "LAB_PENDING", "RESULTS_READY"] as const;

export default function ConsultationsPage() {
  const { visits, startConsultation, orderLabs, completeConsultation } = useVisits();
  const { data: labTests } = useLabTests();
  const { data: medications } = useMedications();

  const queue = visits.filter((v) => (DOCTOR_STAGES as readonly string[]).includes(v.stage));
  const [selectedId, setSelectedId] = useState("");
  const selected = queue.find((v) => v.id === selectedId) ?? queue[0];

  // Lab order form
  const [checkedTests, setCheckedTests] = useState<string[]>([]);
  const [labNotes, setLabNotes] = useState("");

  // Outcome form
  const [diagnosis, setDiagnosis] = useState("");
  const [prescriptions, setPrescriptions] = useState<PrescriptionLine[]>([]);
  const [followUpDate, setFollowUpDate] = useState("");

  const resetForms = () => {
    setCheckedTests([]);
    setLabNotes("");
    setDiagnosis("");
    setPrescriptions([]);
    setFollowUpDate("");
  };

  const sendLabOrder = () => {
    if (!selected || checkedTests.length === 0) return;
    const tests = labTests
      .filter((t) => checkedTests.includes(t.name))
      .map((t) => ({
        name: t.name,
        unit: t.unit,
        range: t.range,
      }));
    orderLabs(selected.id, tests, labNotes);
    resetForms();
  };

  const finish = () => {
    if (!selected || diagnosis.trim() === "") return;
    completeConsultation(selected.id, {
      diagnosis,
      prescriptions: prescriptions.filter((p) => p.medication !== ""),
      followUpDate: followUpDate || undefined,
    });
    resetForms();
    setSelectedId("");
  };

  const addPrescription = () =>
    setPrescriptions([...prescriptions, { medication: "", dosage: "", frequency: "", duration: "" }]);

  const updatePrescription = (i: number, patch: Partial<PrescriptionLine>) =>
    setPrescriptions(prescriptions.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const canDiagnose = selected && (selected.stage === "IN_CONSULTATION" || selected.stage === "RESULTS_READY");

  return (
    <RoleGuard module="consultations">
      <PageHeader
        title="Consultations"
        subtitle={`${queue.length} patient${queue.length === 1 ? "" : "s"} in your care today`}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.6fr]">
        {/* Queue */}
        <Card className="h-fit">
          <CardHeader title="My Queue" subtitle="Triage complete — vitals attached" />
          <VisitQueueList
            visits={queue}
            selectedId={selected?.id}
            onSelect={(id) => {
              setSelectedId(id);
              resetForms();
            }}
            emptyMessage="No patients in the queue. Triaged patients appear here."
          />
        </Card>

        {/* Consultation detail */}
        {selected ? (
          <div className="space-y-4">
            <Card>
              <CardHeader
                title={selected.patientName}
                subtitle={`${selected.mrn} · ${selected.age} yrs · ${selected.gender} · Triaged by ${selected.nurseName ?? "—"}`}
                action={<Avatar name={selected.patientName} />}
              />
              <div className="space-y-4 px-5 pb-5">
                <PipelineStepper visit={selected} />
                <PaymentInfo visit={selected} />
                <VitalsGrid visit={selected} />

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

            {/* Lab status / results */}
            {selected.stage === "LAB_PENDING" && selected.labOrder && (
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
                    <p className="mt-3 text-xs text-slate-400">Notes to lab: {selected.labOrder.notes}</p>
                  )}
                </div>
              </Card>
            )}

            {selected.stage === "RESULTS_READY" && selected.labOrder && (
              <Card>
                <CardHeader
                  title="Lab Report"
                  subtitle={`Returned ${selected.labOrder.completedAt ? `at ${formatTime(selected.labOrder.completedAt)}` : ""}`}
                  action={<Badge tone="teal">Results ready</Badge>}
                />
                <div className="px-5 pb-5">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400">
                        <th className="pb-2 font-medium">Test</th>
                        <th className="pb-2 font-medium">Result</th>
                        <th className="pb-2 font-medium">Reference Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.labOrder.tests.map((t) => (
                        <tr key={t.name} className="border-t border-slate-50">
                          <td className="py-2.5 font-medium text-slate-800">{t.name}</td>
                          <td className="py-2.5 font-semibold text-brand-700">{t.result ?? "—"} {t.unit}</td>
                          <td className="py-2.5 text-slate-400">{t.range}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {selected.labOrder.comments && (
                    <p className="mt-3 rounded-xl bg-[#f3f7f7] px-3.5 py-2.5 text-xs text-slate-500">
                      Technician comments: {selected.labOrder.comments}
                    </p>
                  )}
                </div>
              </Card>
            )}

            {/* Order labs */}
            {selected.stage === "IN_CONSULTATION" && (
              <Card>
                <CardHeader title="Order Lab Tests" subtitle="Sent directly to the lab technician's worklist" />
                <div className="space-y-4 px-5 pb-5">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {labTests.map((t) => (
                      <label
                        key={t.name}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition ${
                          checkedTests.includes(t.name)
                            ? "border-brand-400 bg-brand-50 text-brand-700"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-[#4a929b]"
                          checked={checkedTests.includes(t.name)}
                          onChange={(e) =>
                            setCheckedTests(
                              e.target.checked
                                ? [...checkedTests, t.name]
                                : checkedTests.filter((n) => n !== t.name),
                            )
                          }
                        />
                        {t.name}
                      </label>
                    ))}
                  </div>
                  <input
                    className={inputClass}
                    value={labNotes}
                    onChange={(e) => setLabNotes(e.target.value)}
                    placeholder="Clinical notes for the lab (optional)"
                  />
                  <button
                    onClick={sendLabOrder}
                    disabled={checkedTests.length === 0}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <FlaskConical className="h-4 w-4" /> Send to Laboratory
                  </button>
                </div>
              </Card>
            )}

            {/* Diagnosis & prescription */}
            {canDiagnose && (
              <Card>
                <CardHeader title="Diagnosis & Treatment" subtitle="Completes the consultation and sends the visit to billing" />
                <div className="space-y-4 px-5 pb-5">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Diagnosis</label>
                    <textarea
                      className={`mt-1.5 ${inputClass} min-h-20 resize-y`}
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="Clinical findings and diagnosis…"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-600">Prescription</label>
                      <button
                        onClick={addPrescription}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add medication
                      </button>
                    </div>
                    {prescriptions.length === 0 && (
                      <p className="mt-2 text-xs text-slate-400">No medication added — optional.</p>
                    )}
                    <div className="mt-2 space-y-2">
                      {prescriptions.map((p, i) => (
                        <div key={i} className="grid grid-cols-1 gap-2 rounded-xl bg-[#f3f7f7] p-3 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
                          <select
                            className={inputClass}
                            value={p.medicationId || p.medication}
                            onChange={(e) => {
                              const med = medications.find(
                                (m) => m.id === e.target.value || m.name === e.target.value,
                              );
                              updatePrescription(i, {
                                medication: med?.name || e.target.value,
                                medicationId: med?.id,
                              });
                            }}
                          >
                            <option value="">Medication…</option>
                            {medications.map((m) => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                          <input className={inputClass} value={p.dosage} onChange={(e) => updatePrescription(i, { dosage: e.target.value })} placeholder="Dosage" />
                          <input className={inputClass} value={p.frequency} onChange={(e) => updatePrescription(i, { frequency: e.target.value })} placeholder="Frequency" />
                          <input className={inputClass} value={p.duration} onChange={(e) => updatePrescription(i, { duration: e.target.value })} placeholder="Duration" />
                          <button
                            onClick={() => setPrescriptions(prescriptions.filter((_, idx) => idx !== i))}
                            className="self-center rounded-lg p-2 text-slate-300 hover:bg-white hover:text-rose-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600">Follow-up date (optional)</label>
                    <input
                      type="date"
                      className={`mt-1.5 ${inputClass} sm:max-w-56`}
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                    />
                  </div>

                  <button
                    onClick={finish}
                    disabled={diagnosis.trim() === ""}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" /> Complete & Send to Billing
                  </button>
                </div>
              </Card>
            )}
          </div>
        ) : (
          <Card className="flex min-h-64 items-center justify-center p-10 text-sm text-slate-400">
            Select a patient from your queue to begin.
          </Card>
        )}
      </div>
    </RoleGuard>
  );
}
