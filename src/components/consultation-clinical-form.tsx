"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  emptyClinicalRecord,
  type ClinicalRecord,
  type PastPregnancy,
} from "@/lib/clinical-record";

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground-lighter focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-white p-4 sm:p-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-foreground-lighter">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-foreground-light">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function ConsultationClinicalForm({
  value,
  onChange,
  patientGender,
  patientName,
  vitalsSummary,
  draftNotice,
}: {
  value: ClinicalRecord;
  onChange: (next: ClinicalRecord) => void;
  patientGender: "Male" | "Female" | string;
  patientName: string;
  vitalsSummary?: string;
  draftNotice?: string;
}) {
  const set = <K extends keyof ClinicalRecord>(key: K, v: ClinicalRecord[K]) =>
    onChange({ ...value, [key]: v });

  const setGyn = (patch: Partial<ClinicalRecord["gynaecological"]>) =>
    onChange({
      ...value,
      gynaecological: { ...value.gynaecological, ...patch },
    });

  const setObs = (patch: Partial<ClinicalRecord["obstetric"]>) =>
    onChange({
      ...value,
      obstetric: { ...value.obstetric, ...patch },
    });

  const female = patientGender === "Female";
  const showReproductive =
    female || value.enableReproductiveContext;

  const addPregnancy = () => {
    const row: PastPregnancy = { year: "", outcome: "", notes: "" };
    setObs({
      pastPregnancies: [...value.obstetric.pastPregnancies, row],
    });
  };

  const updatePregnancy = (i: number, patch: Partial<PastPregnancy>) => {
    setObs({
      pastPregnancies: value.obstetric.pastPregnancies.map((p, idx) =>
        idx === i ? { ...p, ...patch } : p,
      ),
    });
  };

  return (
    <div className="space-y-4">
      {draftNotice && (
        <p className="rounded-xl bg-brand-50 px-4 py-2.5 text-xs text-brand-800">
          {draftNotice}
        </p>
      )}

      <Section
        title="Patient biodata & vitals"
        subtitle={`${patientName} · vitals from triage`}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Priority level">
            <select
              className={inputClass}
              value={value.priority}
              onChange={(e) => set("priority", e.target.value)}
            >
              <option value="NORMAL">Normal</option>
              <option value="URGENT">Urgent</option>
              <option value="EMERGENCY">Emergency</option>
            </select>
          </Field>
          <div className="rounded-xl bg-surface-200 px-3.5 py-2.5 text-xs text-foreground-light sm:col-span-1">
            <p className="font-semibold text-foreground-light">Vital signs</p>
            <p className="mt-1 leading-relaxed">
              {vitalsSummary || "No vitals recorded at triage."}
            </p>
          </div>
        </div>
      </Section>

      <Section title="Chief complaints & HPI">
        <Field label="Chief complaints">
          <textarea
            className={`${inputClass} min-h-20 resize-y`}
            value={value.chiefComplaint}
            onChange={(e) => set("chiefComplaint", e.target.value)}
            placeholder="Key symptoms reported by patient…"
          />
        </Field>
        <Field label="History of present illness">
          <textarea
            className={`${inputClass} min-h-24 resize-y`}
            value={value.historyPresentIllness}
            onChange={(e) => set("historyPresentIllness", e.target.value)}
            placeholder="Detailed narrative of the illness…"
          />
        </Field>
      </Section>

      <Section title="Medical & surgical history">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Past medical history">
            <textarea
              className={`${inputClass} min-h-20 resize-y`}
              value={value.pastMedicalHistory}
              onChange={(e) => set("pastMedicalHistory", e.target.value)}
              placeholder="Chronic conditions, allergies, past illnesses…"
            />
          </Field>
          <Field label="Surgical history">
            <textarea
              className={`${inputClass} min-h-20 resize-y`}
              value={value.surgicalHistory}
              onChange={(e) => set("surgicalHistory", e.target.value)}
              placeholder="Past surgeries and procedures…"
            />
          </Field>
          <Field label="Family history">
            <textarea
              className={`${inputClass} min-h-20 resize-y`}
              value={value.familyHistory}
              onChange={(e) => set("familyHistory", e.target.value)}
              placeholder="Relevant family history…"
            />
          </Field>
          <Field label="Social history">
            <textarea
              className={`${inputClass} min-h-20 resize-y`}
              value={value.socialHistory}
              onChange={(e) => set("socialHistory", e.target.value)}
              placeholder="Occupation, lifestyle, substances…"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Gynaecological history"
        subtitle={
          showReproductive
            ? "Reproductive & obstetric context"
            : "Hidden for male / unknown patients unless enabled"
        }
      >
        {!female && (
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border px-3.5 py-2.5 text-sm text-foreground">
            <input
              type="checkbox"
              className="accent-[#4a929b]"
              checked={value.enableReproductiveContext}
              onChange={(e) =>
                set("enableReproductiveContext", e.target.checked)
              }
            />
            Enable partner / reproductive context
          </label>
        )}

        {!showReproductive ? (
          <p className="rounded-xl bg-surface-200 px-3.5 py-3 text-xs text-foreground-light">
            Reproductive &amp; obstetric sections are hidden for this patient.
            Check the box above if partner or reproductive context applies.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="LMP date">
                <input
                  type="date"
                  className={inputClass}
                  value={value.gynaecological.lmpDate}
                  onChange={(e) => setGyn({ lmpDate: e.target.value })}
                />
              </Field>
              <Field label="Menstrual regularity">
                <select
                  className={inputClass}
                  value={value.gynaecological.menstrualRegularity}
                  onChange={(e) =>
                    setGyn({ menstrualRegularity: e.target.value })
                  }
                >
                  <option>Regular</option>
                  <option>Irregular</option>
                  <option>Amenorrhea</option>
                  <option>Unknown</option>
                </select>
              </Field>
              <Field label="Duration (days)">
                <input
                  className={inputClass}
                  value={value.gynaecological.menstrualDurationDays}
                  onChange={(e) =>
                    setGyn({ menstrualDurationDays: e.target.value })
                  }
                  placeholder="e.g. 5"
                />
              </Field>
              <Field label="Dysmenorrhea">
                <select
                  className={inputClass}
                  value={value.gynaecological.dysmenorrhea}
                  onChange={(e) => setGyn({ dysmenorrhea: e.target.value })}
                >
                  <option>None</option>
                  <option>Mild</option>
                  <option>Moderate</option>
                  <option>Severe</option>
                </select>
              </Field>
              <Field label="Cervical cancer screening / Pap smear">
                <textarea
                  className={`${inputClass} min-h-16 resize-y`}
                  value={value.gynaecological.papSmearNotes}
                  onChange={(e) => setGyn({ papSmearNotes: e.target.value })}
                  placeholder="Date of last test, results…"
                />
              </Field>
              <Field label="Contraceptive method">
                <select
                  className={inputClass}
                  value={value.gynaecological.contraceptiveMethod}
                  onChange={(e) =>
                    setGyn({ contraceptiveMethod: e.target.value })
                  }
                >
                  <option value="">Select option…</option>
                  <option>None</option>
                  <option>Pills</option>
                  <option>Injectable</option>
                  <option>Implant</option>
                  <option>IUD</option>
                  <option>Condoms</option>
                  <option>Other</option>
                </select>
              </Field>
              <Field label="Sexual health notes">
                <textarea
                  className={`${inputClass} min-h-16 resize-y`}
                  value={value.gynaecological.sexualHealthNotes}
                  onChange={(e) =>
                    setGyn({ sexualHealthNotes: e.target.value })
                  }
                />
              </Field>
              <Field label="Gynecological history / notes">
                <textarea
                  className={`${inputClass} min-h-16 resize-y`}
                  value={value.gynaecological.gynHistoryNotes}
                  onChange={(e) => setGyn({ gynHistoryNotes: e.target.value })}
                  placeholder="Previous gynecological conditions, surgeries…"
                />
              </Field>
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground-lighter">
                Obstetric history
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Parity (Para X+Y)">
                  <input
                    className={inputClass}
                    value={value.obstetric.parity}
                    onChange={(e) => setObs({ parity: e.target.value })}
                    placeholder="e.g. 2+0"
                  />
                </Field>
                <Field label="Current pregnancy notes">
                  <textarea
                    className={`${inputClass} min-h-16 resize-y`}
                    value={value.obstetric.currentPregnancyNotes}
                    onChange={(e) =>
                      setObs({ currentPregnancyNotes: e.target.value })
                    }
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Obstetric history notes">
                    <textarea
                      className={`${inputClass} min-h-16 resize-y`}
                      value={value.obstetric.obstetricHistoryNotes}
                      onChange={(e) =>
                        setObs({ obstetricHistoryNotes: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground-light">
                    Past pregnancies
                  </p>
                  <button
                    type="button"
                    onClick={addPregnancy}
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-600"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
                {value.obstetric.pastPregnancies.length === 0 ? (
                  <p className="text-xs text-foreground-lighter">
                    No past pregnancy records added.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {value.obstetric.pastPregnancies.map((p, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-1 gap-2 rounded-xl bg-surface-200 p-3 sm:grid-cols-[1fr_1fr_1.5fr_auto]"
                      >
                        <input
                          className={inputClass}
                          value={p.year}
                          onChange={(e) =>
                            updatePregnancy(i, { year: e.target.value })
                          }
                          placeholder="Year"
                        />
                        <input
                          className={inputClass}
                          value={p.outcome}
                          onChange={(e) =>
                            updatePregnancy(i, { outcome: e.target.value })
                          }
                          placeholder="Outcome"
                        />
                        <input
                          className={inputClass}
                          value={p.notes}
                          onChange={(e) =>
                            updatePregnancy(i, { notes: e.target.value })
                          }
                          placeholder="Notes"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setObs({
                              pastPregnancies:
                                value.obstetric.pastPregnancies.filter(
                                  (_, idx) => idx !== i,
                                ),
                            })
                          }
                          className="self-center rounded-lg p-2 text-foreground-muted hover:bg-white hover:text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section title="Review of systems">
        <Field label="Review of systems">
          <textarea
            className={`${inputClass} min-h-24 resize-y`}
            value={value.reviewOfSystems}
            onChange={(e) => set("reviewOfSystems", e.target.value)}
            placeholder="Systematic review of systems…"
          />
        </Field>
      </Section>

      <Section title="Physical examination">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="General examination">
            <textarea
              className={`${inputClass} min-h-20 resize-y`}
              value={value.generalExamination}
              onChange={(e) => set("generalExamination", e.target.value)}
              placeholder="General appearance…"
            />
          </Field>
          <Field label="Specific systems examination">
            <textarea
              className={`${inputClass} min-h-20 resize-y`}
              value={value.systemsExamination}
              onChange={(e) => set("systemsExamination", e.target.value)}
              placeholder="Detailed findings…"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Impression & management plan"
        subtitle="Diagnosis feeds billing completion below"
      >
        <Field label="Impression / diagnosis">
          <textarea
            className={`${inputClass} min-h-20 resize-y`}
            value={value.impression}
            onChange={(e) => set("impression", e.target.value)}
            placeholder="Clinical impression / diagnosis…"
          />
        </Field>
        <Field label="Treatment plan">
          <textarea
            className={`${inputClass} min-h-20 resize-y`}
            value={value.treatmentPlan}
            onChange={(e) => set("treatmentPlan", e.target.value)}
            placeholder="Medications advice, counselling…"
          />
        </Field>
        <Field label="Follow-up instructions">
          <textarea
            className={`${inputClass} min-h-16 resize-y`}
            value={value.followUpInstructions}
            onChange={(e) => set("followUpInstructions", e.target.value)}
            placeholder="Return precautions, review timing…"
          />
        </Field>
        <Field label="Internal notes">
          <textarea
            className={`${inputClass} min-h-16 resize-y`}
            value={value.internalNotes}
            onChange={(e) => set("internalNotes", e.target.value)}
            placeholder="Notes visible to clinical team only…"
          />
        </Field>
      </Section>
    </div>
  );
}

export { emptyClinicalRecord };
