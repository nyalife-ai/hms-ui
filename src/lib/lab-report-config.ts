/**
 * Configurable lab report branding.
 * Hospital name / phone / email / address come from ops settings at print time.
 * Override via localStorage key `nyalife.labReportConfig` (JSON merge).
 */

export type LabReportConfig = {
  tagline: string;
  hours: string;
  emergencyNote: string;
  clinicalDisclaimer: string;
  electronicSignatureNote: string;
  sampleCollectorLabel: string;
};

export const DEFAULT_LAB_REPORT_CONFIG: LabReportConfig = {
  tagline: "Healing Through Precision and Care",
  hours: "8AM - 8PM",
  emergencyNote: "24×7 Hours Emergency Service",
  clinicalDisclaimer:
    "This report is for clinical use only. Results must be correlated with clinical findings. Contact the laboratory for clarification.",
  electronicSignatureNote:
    "This is a computer-generated medical report. Electronic signatures are valid and binding.",
  sampleCollectorLabel: "Sample Collector",
};

const STORAGE_KEY = "nyalife.labReportConfig";

export function getLabReportConfig(): LabReportConfig {
  if (typeof window === "undefined") return DEFAULT_LAB_REPORT_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAB_REPORT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<LabReportConfig>;
    return { ...DEFAULT_LAB_REPORT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_LAB_REPORT_CONFIG;
  }
}

export function saveLabReportConfig(partial: Partial<LabReportConfig>) {
  if (typeof window === "undefined") return;
  const next = { ...getLabReportConfig(), ...partial };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
