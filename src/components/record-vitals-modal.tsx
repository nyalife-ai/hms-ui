"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { FieldLabel } from "@/components/field-label";
import { PrimaryButton } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

export function RecordVitalsModal({
  patientId,
  patientName,
  onClose,
  onSaved,
}: {
  patientId: string;
  patientName: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [respRate, setRespRate] = useState("");
  const [temp, setTemp] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [spo2, setSpo2] = useState("");
  const [urgency, setUrgency] = useState<"NORMAL" | "EMERGENCY">("NORMAL");
  const [observations, setObservations] = useState("");

  const save = async () => {
    if (!user?.id) {
      setError("You must be signed in to record vitals.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const bp =
        systolic.trim() && diastolic.trim()
          ? `${systolic.trim()}/${diastolic.trim()}`
          : undefined;
      await api("/vital-signs", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          recordedBy: user.id,
          bloodPressure: bp,
          heartRate: pulse ? Number(pulse) : undefined,
          respiratoryRate: respRate ? Number(respRate) : undefined,
          temperature: temp ? Number(temp) : undefined,
          weight: weight ? Number(weight) : undefined,
          height: height ? Number(height) : undefined,
          oxygenSaturation: spo2 ? Number(spo2) : undefined,
          urgencyLevel: urgency,
          notes: observations.trim() || undefined,
        }),
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save vitals");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Record clinical vitals
            </h2>
            <p className="text-xs text-slate-400">{patientName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Clinical measurements
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Temperature (°C)</FieldLabel>
              <input
                className={inputClass}
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
                placeholder="e.g. 36.5"
              />
            </div>
            <div>
              <FieldLabel>Blood pressure (mmHg)</FieldLabel>
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  value={systolic}
                  onChange={(e) => setSystolic(e.target.value)}
                  placeholder="120"
                />
                <input
                  className={inputClass}
                  value={diastolic}
                  onChange={(e) => setDiastolic(e.target.value)}
                  placeholder="80"
                />
              </div>
            </div>
            <div>
              <FieldLabel>Heart rate (bpm)</FieldLabel>
              <input
                className={inputClass}
                value={pulse}
                onChange={(e) => setPulse(e.target.value)}
                placeholder="e.g. 72"
              />
            </div>
            <div>
              <FieldLabel>Respiratory rate (bpm)</FieldLabel>
              <input
                className={inputClass}
                value={respRate}
                onChange={(e) => setRespRate(e.target.value)}
                placeholder="e.g. 16"
              />
            </div>
            <div>
              <FieldLabel>Weight (kg)</FieldLabel>
              <input
                className={inputClass}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0.0"
              />
            </div>
            <div>
              <FieldLabel>Height (cm)</FieldLabel>
              <input
                className={inputClass}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="col-span-2">
              <FieldLabel>SPO2 (%)</FieldLabel>
              <input
                className={inputClass}
                value={spo2}
                onChange={(e) => setSpo2(e.target.value)}
                placeholder="98"
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Triage &amp; observations
          </p>
          <div className="mt-2 space-y-3">
            <div>
              <FieldLabel>Urgency level</FieldLabel>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {(
                  [
                    { value: "NORMAL" as const, label: "Normal" },
                    { value: "EMERGENCY" as const, label: "Emergency" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setUrgency(opt.value)}
                    className={`rounded-full border px-3 py-2.5 text-sm font-medium transition ${
                      urgency === opt.value
                        ? opt.value === "EMERGENCY"
                          ? "border-rose-500 bg-rose-50 text-rose-700"
                          : "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Clinical observations</FieldLabel>
              <textarea
                className={`${inputClass} mt-1.5 min-h-20 resize-y`}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Notes from triage / nursing observation…"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-rose-500">{error}</p>}
        <PrimaryButton disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save vitals"}
        </PrimaryButton>
      </div>
    </div>
  );
}
