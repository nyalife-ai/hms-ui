"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

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
      const rows = await api<T[]>(path);
      setData(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
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

export const usePatients = () => useCatalogResource<CatalogPatient>("/catalog/patients");
export const useDoctors = () => useCatalogResource<CatalogDoctor>("/catalog/doctors");
export const useDepartments = () =>
  useCatalogResource<CatalogDepartment>("/catalog/departments");
export const useMedications = () =>
  useCatalogResource<CatalogMedication>("/catalog/medications");
export const useLabTests = () => useCatalogResource<CatalogLabTest>("/catalog/lab-tests");
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

export type FeeSchedule = {
  consult: number;
  lab: number;
  medication: number;
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
  useCatalogResource<CatalogAppointment>("/catalog/appointments");
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
