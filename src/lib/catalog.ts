"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { CatalogClinicalService } from "./clinical-service";
import { unwrapPage } from "./pagination";

export type { CatalogClinicalService } from "./clinical-service";

export type CatalogPatient = {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  phone: string;
  lastVisit: string;
  status: "Active" | "Admitted" | "Discharged";
};

export type PatientSummary = {
  total: number;
  female: number;
  male: number;
  other: number;
  recent7d: number;
};

export type PatientDetail = {
  id: string;
  mrn: string;
  referenceCode: string;
  name: string;
  firstName?: string;
  lastName?: string;
  age: number;
  gender: string;
  phone: string;
  email: string;
  address: string;
  city?: string;
  country?: string;
  postalCode?: string;
  dateOfBirth: string;
  bloodGroup: string;
  occupation: string;
  maritalStatus: string;
  allergies: string;
  chronicDiseases: string;
  registeredAt: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  } | null;
  insurance?: Array<{
    id: string;
    providerName: string;
    memberId: string;
    policyNumber: string;
    status: string;
  }>;
  physical: { height: number | null; weight: number | null };
  counts: {
    scheduledVisits: number;
    consultations: number;
    vitals: number;
    prescriptions: number;
    encounters?: number;
  };
  latestVitals: {
    measuredAt: string;
    bloodPressure: string;
    heartRate: number | null;
    temperature: number | null;
    weight: number | null;
    height: number | null;
    oxygenSaturation: number | null;
    respiratoryRate?: number | null;
    bmi?: number | null;
    source?: string;
  } | null;
  appointments: Array<{
    id: string;
    appointmentNumber: string;
    date: string;
    time: string;
    provider: string;
    status: string;
    rawStatus: string;
    reason?: string;
  }>;
  scheduledAppointments?: Array<{
    id: string;
    appointmentNumber: string;
    date: string;
    time: string;
    provider: string;
    status: string;
    rawStatus: string;
  }>;
  scheduledFollowUps?: Array<{
    id: string;
    date: string;
    reason: string;
    status: string;
    provider?: string;
  }>;
  consultations: Array<{
    id: string;
    date: string;
    physician: string;
    diagnosis: string;
    chiefComplaint?: string;
    diagnoses?: Array<{ code: string; description: string; isPrimary?: boolean }>;
    status: string;
    notes?: string;
    treatmentPlan?: string;
    followUpInstructions?: string;
    historyPresentIllness?: string;
    physicalExamination?: string;
    doctorId?: string;
    appointmentId?: string | null;
    visitId?: string | null;
    href?: string;
  }>;
  vitalsHistory: Array<{
    id: string;
    measuredAt: string;
    bloodPressure: string;
    heartRate: number | null;
    respiratoryRate: number | null;
    temperature: number | null;
    weight: number | null;
    height: number | null;
    bmi?: number | null;
    oxygenSaturation: number | null;
    notes: string;
    urgencyLevel?: string;
    source?: "VITAL_SIGNS" | "TRIAGE";
    recordedBy?: string;
    painLevel?: number | null;
  }>;
  visitTimeline?: Array<{
    id: string;
    kind: "appointment" | "visit" | "consultation";
    label: string;
    date: string;
    time: string;
    when: string;
    provider: string;
    status: string;
    summary: string;
    href: string;
    appointmentId?: string | null;
  }>;
};

export type CatalogDoctor = {
  id: string;
  userId: string;
  name: string;
  specialty: string;
  hours: string;
  available: boolean;
  phone: string;
  email: string;
};

export type CatalogDepartment = {
  id: string;
  name: string;
  code: string;
  location: string;
  description: string;
  staff: number;
  doctors: number;
  nurses: number;
  specialists: number;
  support: number;
  headName: string | null;
};

export type CatalogMedication = {
  id: string;
  name: string;
  category: string;
  stock: number;
  reorderLevel: number;
  expiry: string;
  unit: string;
};

export type CatalogLabTest = {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  range: string;
};

export type CatalogStaff = {
  id: string;
  userId: string;
  name: string;
  employeeId: string;
  role: string;
  department: string;
  status: "Active" | "On Leave";
};

export type CatalogInsurer = {
  id: string;
  name: string;
  code: string;
  integration: "SHA" | "SLADE" | "MANUAL";
  payerSladeCode?: string;
  mode?: "live" | "sandbox";
  channel?: string;
};

function useCatalogResource<T>(path: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = unwrapPage<T>(await api(path));
      setData(page.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load records");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function usePaginatedCatalog<T>(
  path: string,
  params: Record<string, string | number | undefined>,
) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    q.set("page", String(params.page ?? page));
    q.set("limit", String(params.limit ?? limit));
    for (const [k, v] of Object.entries(params)) {
      if (k === "page" || k === "limit") continue;
      if (v === undefined || v === "") continue;
      q.set(k, String(v));
    }
    return q.toString();
  }, [params, page, limit]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = unwrapPage<T>(await api(`${path}?${qs}`));
      setItems(res.items);
      setTotal(res.total);
      setPage(res.page);
      setLimit(res.limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load records");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [path, qs]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    items,
    total,
    page,
    limit,
    loading,
    error,
    refresh,
    setPage,
  };
}

export const usePatients = () =>
  useCatalogResource<CatalogPatient>("/catalog/patients?limit=50");
export const useDoctors = () =>
  useCatalogResource<CatalogDoctor>("/catalog/doctors?limit=50");
export const useDepartments = () =>
  useCatalogResource<CatalogDepartment>("/catalog/departments");
export const useMedications = () =>
  useCatalogResource<CatalogMedication>("/catalog/medications");
export const useLabTests = () => useCatalogResource<CatalogLabTest>("/catalog/lab-tests");
export const useClinicalServices = (kind?: "service" | "surgery") =>
  useCatalogResource<CatalogClinicalService>(
    kind
      ? `/catalog/clinical-services?kind=${kind}`
      : "/catalog/clinical-services",
  );
export const useStaffCatalog = () => useCatalogResource<CatalogStaff>("/catalog/staff");
/** Single Nest insurance gateway catalog (SHA + private insurers). */
export const useInsurers = () =>
  useCatalogResource<CatalogInsurer & { mode?: string; channel?: string }>(
    "/insurance/providers",
  );

export type CatalogAppointment = {
  id: string;
  patientId?: string;
  patient: string;
  mrn?: string;
  phone?: string;
  age?: number;
  gender?: "Male" | "Female";
  doctor: string;
  department: string;
  date: string;
  time: string;
  type: string;
  status: string;
  rawStatus?: string;
};

export type AppointmentSummary = {
  total: number;
  pending: number;
  scheduled: number;
  completed: number;
  cancelled: number;
};

export type AppointmentDetail = {
  id: string;
  visitId?: string | null;
  visitStage?: string | null;
  appointmentNumber: string;
  date: string;
  time: string;
  status: string;
  rawStatus?: string;
  type: string;
  reason: string;
  notes: string;
  additionalNotes?: string;
  bookedAt: string;
  updatedAt: string;
  patient: {
    id: string;
    name: string;
    mrn: string;
    phone: string;
    email: string;
    gender: string;
    bloodGroup: string;
    age: number;
  };
  provider: {
    id: string;
    name: string;
    title: string;
    specialization: string;
    department: string;
  };
  counts: {
    consultations: number;
    labRequests: number;
    prescriptions: number;
    clinicalNotes?: number;
  };
  consultations: Array<{
    id: string;
    date: string;
    diagnosis: string;
    status: string;
    visitId?: string | null;
    href?: string;
  }>;
  labRequests: Array<{
    id: string;
    requestNumber: string;
    test: string;
    priority: string;
    status: string;
    requestedAt: string;
  }>;
  prescriptions: Array<{
    id: string;
    prescriptionId: string;
    prescriptionNumber: string;
    medication: string;
    regimen: string;
    status: string;
  }>;
  clinicalNotes: Array<{
    id: string;
    date: string;
    status: string;
    text: string;
  }>;
};

export type FeeSchedule = {
  consult: number;
  lab: number;
  medication: number;
  consultServiceCode?: string;
  consultServiceName?: string;
  consultationFeeEnabled?: boolean;
};

export type CatalogWard = {
  id: string;
  name: string;
  totalBeds: number;
  occupied: number;
};

export type CatalogScanRequest = {
  id: string;
  patient: string;
  scan: string;
  requestedBy: string;
  scheduled: string;
  status: string;
  rawStatus?: string;
};

export type ActiveAdmission = {
  id: string;
  patientId: string;
  patientName: string;
  mrn: string;
  wardId: string | null;
  wardName: string;
  bedId: string | null;
  bedNumber: string;
  admittingDoctorId: string;
  admittingDoctor: string;
  diagnosis: string | null;
  admittedAt: string;
  status: string;
};

export type IpdBed = {
  id: string;
  wardId: string;
  wardName: string;
  bedNumber: string;
  status: string;
};

export type CatalogInvoice = {
  id: string;
  number: string;
  patient: string;
  amount: number;
  issued: string;
  due: string;
  status: string;
};

export type CatalogConversation = {
  id: string;
  with: string;
  preview: string;
  time: string;
  unread: number;
};

export type InventoryPayload = {
  items: Array<{
    id: string;
    name: string;
    sku: string;
    category: string;
    quantity: number;
    unit: string;
    pct: number;
    expiry: string;
    status: "Available" | "Low" | "Out of Stock";
  }>;
  categories: Array<{ name: string; pct: number; count: number; color: string }>;
  stats: {
    totalItems: number;
    lowStock: number;
    outOfStock: number;
    totalUnits: number;
  };
  activity: Array<{ id: string; title: string; meta: string; time: string }>;
};

export type DashboardSummary = {
  patients: number;
  appointmentsToday: number;
  activeVisits: number;
  doctors: number;
  invoicesOpen: number;
  deptDistribution: Array<{ name: string; value: number; color: string }>;
  recentAppointments: CatalogAppointment[];
  ageStages?: Array<{ name: string; value: number }>;
  revenueSeries?: Array<{ date: string; amount: number }>;
  inventoryUsageSeries?: Array<{ date: string; units: number }>;
  reports?: Array<{ id: string; title: string; source: string; time: string }>;
};

export const useAppointments = () =>
  useCatalogResource<CatalogAppointment>("/catalog/appointments?limit=50");

export function useAppointmentSummary() {
  const [data, setData] = useState<AppointmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<AppointmentSummary>("/catalog/appointments/summary"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load summary");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function usePatientSummary() {
  const [data, setData] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<PatientSummary>("/catalog/patients/summary"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load summary");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export const useWards = () => useCatalogResource<CatalogWard>("/catalog/wards");
export const useRadiologyQueue = () =>
  useCatalogResource<CatalogScanRequest>("/catalog/radiology-queue");
export const useInvoices = () =>
  useCatalogResource<CatalogInvoice>("/catalog/invoices");
export const useConversations = () =>
  useCatalogResource<CatalogConversation>("/catalog/conversations");

export function useInventory() {
  const [data, setData] = useState<InventoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<InventoryPayload>("/catalog/inventory"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export type CatalogLabRequest = {
  id: string;
  patient: string;
  test: string;
  requestedBy: string;
  priority: string;
  status: string;
};

export const useLabRequests = () =>
  useCatalogResource<CatalogLabRequest>("/ops/lab-requests");

export type CatalogScanType = {
  id: string;
  scan_type: string;
  category: string | null;
};

export const useScanTypes = () =>
  useCatalogResource<CatalogScanType>("/ops/scan-types");

export function useFeeSchedule() {
  const [fees, setFees] = useState<FeeSchedule>({
    consult: 2500,
    lab: 1500,
    medication: 800,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<FeeSchedule>("/billing/fees");
        if (!cancelled && data) setFees(data);
      } catch {
        // keep defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { fees, loading };
}

export function useDashboardSummary() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const summary = await api<DashboardSummary>("/catalog/dashboard-summary");
      setData(summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refresh();
    }, 45_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { data, loading, error, refresh };
}
