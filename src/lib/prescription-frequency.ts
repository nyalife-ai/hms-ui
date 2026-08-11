/** Standard Rx frequency abbreviations used on the doctor desk. */

export const PRESCRIPTION_FREQUENCIES = [
  { value: "OD", label: "OD — Once daily (1×/day)" },
  { value: "BD", label: "BD — Twice daily (2×/day)" },
  { value: "TDS", label: "TDS — Three times daily (3×/day)" },
  { value: "QDS", label: "QDS — Four times daily (4×/day)" },
  { value: "PRN", label: "PRN — As needed" },
  { value: "STAT", label: "STAT — Immediately" },
] as const;

export type PrescriptionFrequency =
  (typeof PRESCRIPTION_FREQUENCIES)[number]["value"];

export function isPrescriptionFrequency(
  value: string,
): value is PrescriptionFrequency {
  return PRESCRIPTION_FREQUENCIES.some((f) => f.value === value);
}
