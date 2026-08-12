/** Deep links from consultations / appointments into scoped clinical lists. */

export function relatedLabsHref(q: {
  visitId?: string;
  appointmentId?: string;
  patientName?: string;
}): string {
  const p = new URLSearchParams();
  if (q.visitId) p.set("visitId", q.visitId);
  if (q.appointmentId) p.set("appointmentId", q.appointmentId);
  if (q.patientName) p.set("patient", q.patientName);
  return `/laboratory/related?${p.toString()}`;
}

export function relatedPrescriptionsHref(q: {
  visitId?: string;
  appointmentId?: string;
  patientName?: string;
}): string {
  const p = new URLSearchParams();
  if (q.visitId) p.set("visitId", q.visitId);
  if (q.appointmentId) p.set("appointmentId", q.appointmentId);
  if (q.patientName) p.set("patient", q.patientName);
  return `/pharmacy/related?${p.toString()}`;
}

export function consultationJourneyHref(visitId: string, tab?: string): string {
  return tab ? `/consultations/${visitId}?tab=${tab}` : `/consultations/${visitId}`;
}
