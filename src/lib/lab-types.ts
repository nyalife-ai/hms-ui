export type LabResultLine = {
  id: string;
  parameterId: string;
  parameterName: string | null;
  unitOfMeasurement: string | null;
  normalReferenceRange: string | null;
  testTypeId: string | null;
  testName: string | null;
  resultValue: string | null;
  interpretation: string | null;
  notes: string | null;
  performedAt: string | null;
  verifiedAt: string | null;
  performedByEmail: string | null;
  verifiedByEmail: string | null;
  isCritical: boolean;
  isVerified: boolean;
};

export type LabSampleRow = {
  id: string;
  sampleId: string;
  sampleType: string;
  status: string;
  collectedAt: string;
  collectedByName: string | null;
  notes: string | null;
};

export type LabOrderedPanel = {
  id: string;
  testName: string;
  category: string | null;
  parameters: Array<{
    id: string;
    parameterName: string;
    unitOfMeasurement: string | null;
    normalReferenceRange: string | null;
    displayOrder: number;
  }>;
};

export type LabRequestDetail = {
  id: string;
  requestNumber: string | null;
  patientId: string;
  patientName: string;
  mrn: string | null;
  patientPhone: string | null;
  patientEmail: string | null;
  patientGender: string | null;
  patientAge: number;
  patientDob: string | null;
  requestingDoctorId: string | null;
  requestingDoctor: string | null;
  requestingDoctorDepartment?: string | null;
  requestingDoctorSpecialization?: string | null;
  requestedBy: string;
  requestedByName: string | null;
  consultationId: string | null;
  visitId?: string | null;
  priority: string;
  requestDate: string;
  status: string;
  notes: string | null;
  observations: string | null;
  conclusion: string | null;
  evidenceName: string | null;
  releasedToDoctorAt?: string | null;
  releasedToDoctorBy?: string | null;
  releasedToDoctor?: boolean;
  categories: string[];
  createdAt: string;
  updatedAt: string;
  samples: LabSampleRow[];
  results: LabResultLine[];
  resultCount: number;
  verifiedCount: number;
  criticalCount: number;
  allVerified: boolean;
  orderedTestTypes: LabOrderedPanel[];
  resultEntryParameters: Array<{
    id: string;
    parameterName: string;
    unitOfMeasurement: string | null;
    normalReferenceRange: string | null;
    testName: string;
    testTypeId: string;
  }>;
};

/** Doctor Consultation Lab Report — released LIS lines for a visit */
export type VisitLabReport = {
  visitId: string;
  released: boolean;
  releasedAt: string | null;
  requestCount: number;
  releasedRequestCount: number;
  requests: Array<{
    id: string;
    requestNumber: string | null;
    status: string;
    observations: string | null;
    conclusion: string | null;
    releasedToDoctorAt?: string | null;
    resultCount: number;
    verifiedCount: number;
    criticalCount: number;
  }>;
  lines: Array<
    LabResultLine & {
      requestId: string;
      requestNumber: string | null;
      requestStatus: string;
    }
  >;
  observations: string | null;
  conclusion: string | null;
};

export type LabResultBundle = {
  id: string;
  requestNumber: string | null;
  patientName: string;
  mrn: string | null;
  requestingDoctor: string | null;
  priority: string;
  status: string;
  requestDate: string;
  updatedAt: string;
  resultCount: number;
  verifiedCount: number;
  criticalCount: number;
  allVerified: boolean;
  panels: string[];
  results: LabResultLine[];
};

export function statusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "IN_PROGRESS":
      return "Processing";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}
