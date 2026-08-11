/** Clinical orderable billable services (procedures / surgeries). */

export type ClinicalServiceKind = "service" | "surgery";

export type CatalogClinicalService = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  description: string | null;
  standardPrice: string;
  kind: ClinicalServiceKind;
};

export type OrderedClinicalItem = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  unitPrice: string;
};

export const CLINICAL_SERVICE_CATEGORIES = [
  "Antenatal",
  "Consultation",
  "Delivery",
  "Family Planning",
  "General Services",
  "Vaccines",
  "Procedures",
  "Surgery",
] as const;

export function toOrderedItem(s: CatalogClinicalService): OrderedClinicalItem {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    category: s.category,
    unitPrice: s.standardPrice,
  };
}
