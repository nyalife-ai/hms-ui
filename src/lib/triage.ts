/** Structured clinical triage intake types (mirrors backend triage.types). */

export type TriagePriority = "NORMAL" | "URGENT" | "EMERGENCY";

export type TriageSymptom = {
  symptomId: string;
  symptom: string;
  category?: string;
  onset?: "SUDDEN" | "GRADUAL" | "UNKNOWN";
  durationValue?: string;
  durationUnit?: "HOURS" | "DAYS" | "WEEKS" | "MONTHS" | "YEARS";
  severity?: "MILD" | "MODERATE" | "SEVERE";
  progression?: "IMPROVING" | "STABLE" | "WORSENING" | "UNKNOWN";
  associatedSymptoms?: string;
  notes?: string;
};

export type TriageRelevantHistory = {
  conditions?: string[];
  conditionsOther?: string;
  currentMedications?: string;
  allergiesKnown?: boolean;
  allergens?: string;
  allergyReaction?: string;
  surgicalHistory?: string;
};

export type TriageAssessment = {
  generalAppearance?: string;
  mentalStatus?: string;
  mobility?: string;
  respiratoryEffort?: string;
  redFlags?: string[];
};

export type TriageRecord = {
  reasonForVisit: string;
  reasonForVisitOther?: string;
  chiefComplaint: string;
  symptoms: TriageSymptom[];
  relevantHistory?: TriageRelevantHistory;
  contextsEnabled?: Array<
    "ANTENATAL" | "PAEDIATRIC" | "GYNAECOLOGICAL" | "CHRONIC" | "OTHER"
  >;
  antenatal?: Record<string, unknown>;
  gynaecological?: Record<string, unknown>;
  paediatric?: Record<string, unknown>;
  chronic?: Record<string, unknown>;
  assessment?: TriageAssessment;
  notes?: string;
  priority: TriagePriority;
  priorityReason?: string;
  disposition?: "SEND_TO_DOCTOR" | "OBSERVE" | "REFER_EMERGENCY" | "OTHER";
  dispositionNotes?: string;
  completedAt: string;
  recordedByName?: string;
  recordedByUserId?: string;
  receptionReasonSnapshot?: string;
};

export type SymptomCatalogueResponse = {
  symptoms: Array<{ id: string; label: string; category: string }>;
  reasonOptions: string[];
  conditions: string[];
  redFlags: string[];
};

export type TriageSubmitPayload = {
  vitals: {
    temperature: string;
    systolic: string;
    diastolic: string;
    pulse: string;
    respRate: string;
    spo2: string;
    weightKg: string;
    heightCm?: string;
    painScore?: string;
    painLocation?: string;
    bloodGlucose?: string;
    bloodGlucoseContext?: "RANDOM" | "FASTING" | "OTHER" | "UNKNOWN";
    headCircumferenceCm?: string;
    muacCm?: string;
    temperatureMethod?: string;
  };
  doctorName: string;
  doctorStaffId?: string;
  nurseName: string;
  reasonForVisit: string;
  reasonForVisitOther?: string;
  chiefComplaint: string;
  symptoms?: TriageSymptom[];
  relevantHistory?: TriageRelevantHistory;
  contextsEnabled?: string[];
  antenatal?: Record<string, unknown>;
  gynaecological?: Record<string, unknown>;
  paediatric?: Record<string, unknown>;
  chronic?: Record<string, unknown>;
  assessment?: TriageAssessment;
  notes?: string;
  priority: TriagePriority;
  priorityReason?: string;
  disposition?: string;
  dispositionNotes?: string;
};

export function calcBmi(heightCm: string, weightKg: string): string {
  const h = Number(heightCm);
  const w = Number(weightKg);
  if (!Number.isFinite(h) || h <= 0 || !Number.isFinite(w) || w <= 0) return "";
  const m = h / 100;
  return (w / (m * m)).toFixed(1);
}

export function priorityTone(
  p?: string,
): "red" | "amber" | "slate" | "blue" {
  if (p === "EMERGENCY") return "red";
  if (p === "URGENT") return "amber";
  return "slate";
}
