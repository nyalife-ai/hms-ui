"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import type { BadgeTone } from "@/components/ui";
import type { ClinicalRecord } from "./clinical-record";
import type { OrderedClinicalItem } from "./clinical-service";

export type VisitStage =
  | "CHECKED_IN"
  | "AWAITING_PAYMENT"
  | "WAITING_DOCTOR"
  | "IN_CONSULTATION"
  | "LAB_PENDING"
  | "RESULTS_READY"
  | "READY_FOR_BILLING"
  | "CLAIM_SUBMITTED"
  | "COMPLETED";

export type ConsultFeeStatus = "PENDING" | "PAID" | "WAIVED";

export const STAGE_META: Record<VisitStage, { label: string; tone: BadgeTone; step: number }> = {
  CHECKED_IN: { label: "Waiting for Triage", tone: "blue", step: 2 },
  AWAITING_PAYMENT: { label: "Pay at Finance", tone: "amber", step: 1 },
  WAITING_DOCTOR: { label: "Waiting for Doctor", tone: "amber", step: 3 },
  IN_CONSULTATION: { label: "In Consultation", tone: "teal", step: 3 },
  LAB_PENDING: { label: "At Laboratory", tone: "amber", step: 4 },
  RESULTS_READY: { label: "Lab Results Ready", tone: "blue", step: 5 },
  READY_FOR_BILLING: { label: "Ready for Billing", tone: "amber", step: 6 },
  CLAIM_SUBMITTED: { label: "Awaiting Insurer", tone: "blue", step: 7 },
  COMPLETED: { label: "Completed", tone: "green", step: 8 },
};

export const PIPELINE_STEPS = [
  "Reception",
  "Triage",
  "Doctor",
  "Laboratory",
  "Diagnosis",
  "Billing",
  "Insurer",
  "Done",
] as const;

export const PIPELINE_TAB_IDS = [
  "reception",
  "triage",
  "doctor",
  "laboratory",
  "diagnosis",
  "billing",
  "insurer",
  "done",
] as const;

export type PipelineTabId = (typeof PIPELINE_TAB_IDS)[number];

export type InsuranceStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Vitals {
  temperature: string;
  systolic: string;
  diastolic: string;
  pulse: string;
  respRate: string;
  spo2: string;
  weightKg: string;
  heightCm?: string;
  bmi?: string;
  painScore?: string;
  painLocation?: string;
  bloodGlucose?: string;
  bloodGlucoseContext?: "RANDOM" | "FASTING" | "OTHER" | "UNKNOWN";
  headCircumferenceCm?: string;
  muacCm?: string;
  temperatureMethod?: string;
  recordedAt?: string;
  recordedBy?: string;
}

export interface LabTestOrder {
  name: string;
  unit: string;
  range: string;
  result?: string;
}

export interface PrescriptionLine {
  medication: string;
  medicationId?: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity?: number;
}

export interface Visit {
  id: string;
  patientName: string;
  mrn: string;
  age: number;
  gender: "Male" | "Female";
  phone: string;
  firstVisit: boolean;
  appointmentId?: string;
  reasonForVisit?: string;
  additionalNotes?: string;
  payment: {
    method: "CASH" | "INSURANCE";
    provider?: string;
    providerId?: string;
    policyNumber?: string;
    status?: InsuranceStatus;
    memberName?: string;
    benefitBalance?: number;
    authorizationCode?: string;
    authToken?: string;
    ediAuthGuid?: string;
    benefitCode?: string;
    benefitType?: string;
    schemeName?: string;
    schemeCode?: string;
  };
  stage: VisitStage;
  checkedInAt: string;
  vitals?: Vitals;
  nurseName?: string;
  doctorName?: string;
  doctorStaffId?: string;
  /** Structured clinical triage intake (authoritative after triage) */
  triage?: import("./triage").TriageRecord;
  triagePriority?: import("./triage").TriagePriority;
  triageCompletedAt?: string;
  labOrder?: {
    tests: LabTestOrder[];
    notes?: string;
    comments?: string;
    completedAt?: string;
  };
  diagnosis?: string;
  prescriptions?: PrescriptionLine[];
  followUpDate?: string;
  clinicalRecord?: ClinicalRecord;
  orderedServices?: OrderedClinicalItem[];
  orderedSurgeries?: OrderedClinicalItem[];
  billing?: {
    total: number;
    mode: "CASH" | "CLAIM";
    claimId?: string;
    claimStatus?: "SUBMITTED" | "ACCEPTED" | "REJECTED";
    invoiceId?: string;
    invoiceNumber?: string;
    receiptId?: string;
    receiptNumber?: string;
    mpesaReceipt?: string;
    paymentChannel?: "CASH" | "MPESA" | "INSURANCE";
    consultFeeStatus?: ConsultFeeStatus;
    consultFeeAmount?: number;
    consultFeePaidAt?: string;
  };
  pharmacy?: {
    dispensed?: boolean;
    dispensedAt?: string;
    prescriptionId?: string;
    prescriptionNumber?: string;
    sentAt?: string;
  };
}

interface VisitContextValue {
  visits: Visit[];
  loading: boolean;
  refresh: () => Promise<void>;
  checkIn: (visit: Omit<Visit, "id" | "stage" | "checkedInAt">) => Promise<void>;
  recordTriage: (
    visitId: string,
    payload: import("./triage").TriageSubmitPayload,
  ) => Promise<void>;
  chargeConsultFee: (visitId: string) => Promise<void>;
  waiveConsultFee: (visitId: string) => Promise<void>;
  collectConsultFee: (
    visitId: string,
    mode: "CASH" | "MPESA",
    opts?: { transactionReference?: string; mpesaReceipt?: string },
  ) => Promise<void>;
  startConsultation: (visitId: string) => Promise<void>;
  updateReception: (
    visitId: string,
    patch: { reasonForVisit?: string; additionalNotes?: string },
  ) => Promise<void>;
  saveClinicalRecord: (visitId: string, clinicalRecord: ClinicalRecord) => Promise<void>;
  saveClinicalOrders: (
    visitId: string,
    orders: {
      orderedServices?: OrderedClinicalItem[];
      orderedSurgeries?: OrderedClinicalItem[];
    },
  ) => Promise<void>;
  orderLabs: (visitId: string, tests: LabTestOrder[], notes: string) => Promise<void>;
  submitLabResults: (visitId: string, tests: LabTestOrder[], comments: string) => Promise<void>;
  completeConsultation: (
    visitId: string,
    outcome: {
      diagnosis: string;
      prescriptions: PrescriptionLine[];
      followUpDate?: string;
      clinicalRecord?: ClinicalRecord;
      orderedServices?: OrderedClinicalItem[];
      orderedSurgeries?: OrderedClinicalItem[];
    },
  ) => Promise<void>;
  finalizeBilling: (visitId: string, total: number, claimId?: string) => Promise<Visit>;
  updateClaimStatus: (visitId: string, status: "SUBMITTED" | "ACCEPTED" | "REJECTED") => Promise<void>;
  syncClaim: (visitId: string, providerId: string) => Promise<{
    status?: "SUBMITTED" | "ACCEPTED" | "REJECTED";
    signedOff?: boolean;
  }>;
}

const VisitContext = createContext<VisitContextValue | null>(null);

export function VisitProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setVisits([]);
      setLoading(false);
      return;
    }
    try {
      const data = await api<Visit[]>("/visits");
      setVisits(data);
    } catch {
      // Keep last known list if the request fails mid-session
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  // Light poll — avoid hammering Supabase pool while other desks are open
  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refresh();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [user, refresh]);

  const value: VisitContextValue = {
    visits,
    loading,
    refresh,
    checkIn: async (visit) => {
      await api<Visit>("/visits/check-in", {
        method: "POST",
        body: JSON.stringify(visit),
      });
      await refresh();
    },
    recordTriage: async (visitId, payload) => {
      await api(`/visits/${visitId}/triage`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await refresh();
    },
    chargeConsultFee: async (visitId) => {
      await api(`/visits/${visitId}/charge-consult-fee`, { method: "POST" });
      await refresh();
    },
    waiveConsultFee: async (visitId) => {
      await api(`/visits/${visitId}/waive-consult-fee`, { method: "POST" });
      await refresh();
    },
    collectConsultFee: async (visitId, mode, opts) => {
      await api(`/visits/${visitId}/collect-consult-fee`, {
        method: "POST",
        body: JSON.stringify({
          mode,
          transactionReference: opts?.transactionReference,
          mpesaReceipt: opts?.mpesaReceipt,
        }),
      });
      await refresh();
    },
    startConsultation: async (visitId) => {
      await api(`/visits/${visitId}/start-consultation`, { method: "POST" });
      await refresh();
    },
    updateReception: async (visitId, patch) => {
      await api(`/visits/${visitId}/reception`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await refresh();
    },
    saveClinicalRecord: async (visitId, clinicalRecord) => {
      await api(`/visits/${visitId}/clinical-notes`, {
        method: "POST",
        body: JSON.stringify({ clinicalRecord }),
      });
      await refresh();
    },
    saveClinicalOrders: async (visitId, orders) => {
      await api(`/visits/${visitId}/clinical-orders`, {
        method: "POST",
        body: JSON.stringify(orders),
      });
      await refresh();
    },
    orderLabs: async (visitId, tests, notes) => {
      await api(`/visits/${visitId}/order-labs`, {
        method: "POST",
        body: JSON.stringify({ tests, notes }),
      });
      await refresh();
    },
    submitLabResults: async (visitId, tests, comments) => {
      await api(`/visits/${visitId}/lab-results`, {
        method: "POST",
        body: JSON.stringify({ tests, comments }),
      });
      await refresh();
    },
    completeConsultation: async (visitId, outcome) => {
      await api(`/visits/${visitId}/complete`, {
        method: "POST",
        body: JSON.stringify(outcome),
      });
      await refresh();
    },
    finalizeBilling: async (visitId, total, claimId) => {
      const visit = await api<Visit>(`/visits/${visitId}/billing`, {
        method: "POST",
        body: JSON.stringify({ total, claimId }),
      });
      await refresh();
      return visit;
    },
    updateClaimStatus: async (visitId, status) => {
      await api(`/visits/${visitId}/claim-status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refresh();
    },
    syncClaim: async (visitId, providerId) => {
      const data = await api<{
        ok: boolean;
        status?: "SUBMITTED" | "ACCEPTED" | "REJECTED";
        signedOff?: boolean;
        error?: string;
      }>("/insurance/claims/sync", {
        method: "POST",
        body: JSON.stringify({ visitId, providerId }),
      });
      await refresh();
      return { status: data.status, signedOff: data.signedOff };
    },
  };

  return <VisitContext.Provider value={value}>{children}</VisitContext.Provider>;
}

export function useVisits(): VisitContextValue {
  const ctx = useContext(VisitContext);
  if (!ctx) throw new Error("useVisits must be used inside <VisitProvider>");
  return ctx;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
