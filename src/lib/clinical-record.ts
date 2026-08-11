/** Shared clinical consultation record (doctor desk + visit payload). */

export type PastPregnancy = {
  year: string;
  outcome: string;
  notes: string;
};

export type GynaecologicalHistory = {
  lmpDate: string;
  menstrualRegularity: string;
  menstrualDurationDays: string;
  dysmenorrhea: string;
  papSmearNotes: string;
  contraceptiveMethod: string;
  sexualHealthNotes: string;
  gynHistoryNotes: string;
};

export type ObstetricHistory = {
  parity: string;
  currentPregnancyNotes: string;
  obstetricHistoryNotes: string;
  pastPregnancies: PastPregnancy[];
};

export type ClinicalRecord = {
  priority: string;
  chiefComplaint: string;
  historyPresentIllness: string;
  pastMedicalHistory: string;
  surgicalHistory: string;
  familyHistory: string;
  socialHistory: string;
  enableReproductiveContext: boolean;
  gynaecological: GynaecologicalHistory;
  obstetric: ObstetricHistory;
  reviewOfSystems: string;
  generalExamination: string;
  systemsExamination: string;
  impression: string;
  treatmentPlan: string;
  followUpInstructions: string;
  internalNotes: string;
};

export function emptyClinicalRecord(): ClinicalRecord {
  return {
    priority: "NORMAL",
    chiefComplaint: "",
    historyPresentIllness: "",
    pastMedicalHistory: "",
    surgicalHistory: "",
    familyHistory: "",
    socialHistory: "",
    enableReproductiveContext: false,
    gynaecological: {
      lmpDate: "",
      menstrualRegularity: "Regular",
      menstrualDurationDays: "",
      dysmenorrhea: "None",
      papSmearNotes: "",
      contraceptiveMethod: "",
      sexualHealthNotes: "",
      gynHistoryNotes: "",
    },
    obstetric: {
      parity: "",
      currentPregnancyNotes: "",
      obstetricHistoryNotes: "",
      pastPregnancies: [],
    },
    reviewOfSystems: "",
    generalExamination: "",
    systemsExamination: "",
    impression: "",
    treatmentPlan: "",
    followUpInstructions: "",
    internalNotes: "",
  };
}

export function mergeClinicalRecord(
  base: ClinicalRecord,
  patch?: Partial<ClinicalRecord> | null,
): ClinicalRecord {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    gynaecological: {
      ...base.gynaecological,
      ...(patch.gynaecological ?? {}),
    },
    obstetric: {
      ...base.obstetric,
      ...(patch.obstetric ?? {}),
      pastPregnancies:
        patch.obstetric?.pastPregnancies ?? base.obstetric.pastPregnancies,
    },
  };
}

export function clinicalDraftKey(visitId: string): string {
  return `nyalife.clinical-draft.${visitId}`;
}
