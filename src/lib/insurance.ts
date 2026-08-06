export type ClaimStatus = "SUBMITTED" | "ACCEPTED" | "REJECTED";

export interface EligibilityBenefit {
  status: string;
  benefitType?: string;
  benefitCode?: string;
  name?: string;
  balance?: number;
}

export interface EligibilityResult {
  ok: boolean;
  error?: string;
  sessionId?: string;
  requiresOtp?: boolean;
  mode?: "live" | "sandbox";
  policyId?: string;
  contactId?: string;
  beneficiaryId?: string;
  benefits?: EligibilityBenefit[];
  member?: {
    name: string;
    phoneMasked: string;
  };
  coverage?: {
    status: "ACTIVE" | "INACTIVE" | "UNVERIFIED";
    scheme?: string;
    balance?: number;
  };
}

export interface OtpSendResult {
  ok: boolean;
  sentTo?: string;
  sandboxOtp?: string;
  error?: string;
  mode?: "live" | "sandbox";
}

export interface OtpVerifyResult {
  ok: boolean;
  verified: boolean;
  authorizationCode?: string;
  authToken?: string;
  ediAuthGuid?: string;
  benefitCode?: string;
  benefitType?: string;
  schemeName?: string;
  schemeCode?: string;
  error?: string;
  mode?: "live" | "sandbox";
}
