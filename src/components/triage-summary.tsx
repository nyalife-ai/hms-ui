"use client";

import { useState } from "react";
import { Badge, Card, CardHeader } from "@/components/ui";
import { VitalsGrid } from "@/components/visit-flow";
import { priorityTone, type TriageRecord } from "@/lib/triage";
import { formatTime, type Visit } from "@/lib/visits";

function symptomLine(s: TriageRecord["symptoms"][number]) {
  const bits = [
    s.symptom,
    s.severity ? s.severity.toLowerCase() : null,
    s.durationValue
      ? `${s.durationValue} ${(s.durationUnit || "DAYS").toLowerCase()}`
      : null,
    s.progression ? s.progression.toLowerCase() : null,
  ].filter(Boolean);
  return bits.join(" — ");
}

export function TriageSummary({ visit }: { visit: Visit }) {
  const [open, setOpen] = useState(false);
  const t = visit.triage;
  if (!t && !visit.vitals) return null;

  const priority = visit.triagePriority ?? t?.priority ?? "NORMAL";

  return (
    <Card>
      <CardHeader
        title="Triage summary"
        subtitle={
          t
            ? `Triaged by ${t.recordedByName || visit.nurseName || "—"} · ${
                t.completedAt ? formatTime(t.completedAt) : "—"
              }`
            : "Vitals from triage"
        }
      />
      <div className="space-y-3 px-5 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={priorityTone(priority)}>{priority}</Badge>
          {t?.priorityReason && (
            <span className="text-xs text-slate-500">{t.priorityReason}</span>
          )}
          {(t?.assessment?.redFlags?.length ?? 0) > 0 && (
            <Badge tone="red">Red flags</Badge>
          )}
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase text-slate-400">
              Reason for visit
            </p>
            <p className="text-slate-800">
              {t?.reasonForVisit || visit.reasonForVisit || "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-slate-400">
              Chief complaint
            </p>
            <p className="text-slate-800">{t?.chiefComplaint || "—"}</p>
          </div>
        </div>

        {t?.symptoms?.length ? (
          <div>
            <p className="text-[10px] font-semibold uppercase text-slate-400">
              Reported symptoms
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
              {t.symptoms.map((s, i) => (
                <li key={`${s.symptomId}-${i}`}>{symptomLine(s)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {visit.vitals && (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase text-slate-400">
              Vital signs
            </p>
            <VitalsGrid visit={visit} />
          </div>
        )}

        {(visit.vitals?.painScore || t?.notes) && (
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {visit.vitals?.painScore && (
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-400">
                  Pain
                </p>
                <p className="text-slate-800">
                  {visit.vitals.painScore}/10
                  {visit.vitals.painLocation
                    ? ` · ${visit.vitals.painLocation}`
                    : ""}
                </p>
              </div>
            )}
            {t?.notes && (
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-400">
                  Triage notes
                </p>
                <p className="whitespace-pre-wrap text-slate-800">{t.notes}</p>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-xs font-semibold text-brand-700 hover:underline"
        >
          {open ? "Hide complete triage assessment" : "View complete triage assessment"}
        </button>

        {open && t && (
          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm">
            {t.relevantHistory && (
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-400">
                  Relevant history
                </p>
                <p className="text-slate-700">
                  {[
                    t.relevantHistory.conditions?.join(", "),
                    t.relevantHistory.conditionsOther,
                    t.relevantHistory.allergiesKnown === false
                      ? "No known allergies"
                      : t.relevantHistory.allergens
                        ? `Allergy: ${t.relevantHistory.allergens}`
                        : null,
                    t.relevantHistory.currentMedications
                      ? `Meds: ${t.relevantHistory.currentMedications}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </div>
            )}
            {t.assessment && (
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["Appearance", t.assessment.generalAppearance],
                    ["Mental status", t.assessment.mentalStatus],
                    ["Mobility", t.assessment.mobility],
                    ["Respiratory effort", t.assessment.respiratoryEffort],
                  ] as const
                ).map(([label, val]) =>
                  val ? (
                    <div key={label}>
                      <p className="text-[10px] uppercase text-slate-400">{label}</p>
                      <p className="text-slate-700">{val}</p>
                    </div>
                  ) : null,
                )}
                {t.assessment.redFlags?.length ? (
                  <div className="sm:col-span-2">
                    <p className="text-[10px] uppercase text-slate-400">Red flags</p>
                    <p className="text-rose-700">{t.assessment.redFlags.join(", ")}</p>
                  </div>
                ) : null}
              </div>
            )}
            {t.contextsEnabled?.length ? (
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-400">
                  Screening contexts
                </p>
                <p className="text-slate-700">{t.contextsEnabled.join(", ")}</p>
              </div>
            ) : null}
            {visit.additionalNotes && (
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-400">
                  Reception administrative notes
                </p>
                <p className="whitespace-pre-wrap text-slate-600">
                  {visit.additionalNotes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
