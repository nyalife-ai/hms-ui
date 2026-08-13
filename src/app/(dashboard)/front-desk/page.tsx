"use client";

import { CalendarDays, Send, ShieldCheck, Loader2, Smartphone, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FieldLabel } from "@/components/field-label";
import { PatientSearchSelect } from "@/components/patient-search-select";
import { RoleGuard } from "@/components/role-guard";
import { Avatar, Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { VisitQueueList } from "@/components/visit-flow";
import { api } from "@/lib/api";
import {
  useAppointments,
  useInsurers,
  type CatalogAppointment,
  type CatalogPatient,
  type FeeSchedule,
} from "@/lib/catalog";
import { useVisits } from "@/lib/visits";
import type {
  EligibilityBenefit,
  EligibilityResult,
  OtpSendResult,
  OtpVerifyResult,
} from "@/lib/insurance";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type VerifyState =
  | "IDLE"
  | "CHECKING"
  | "MEMBER_FOUND" // eligibility ok, awaiting OTP send
  | "SENDING_OTP"
  | "OTP_SENT"
  | "VERIFYING_OTP"
  | "VERIFIED"
  | "MANUAL" // insurer without a portal
  | "ERROR";

export default function FrontDeskPage() {
  const { visits, checkIn, refresh } = useVisits();
  const { data: insurers } = useInsurers();
  const { data: appointments, refresh: refreshAppointments } = useAppointments();

  const [firstVisit, setFirstVisit] = useState(false);
  const [existingId, setExistingId] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<CatalogPatient | null>(null);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"Male" | "Female">("Female");
  const [kinName, setKinName] = useState("");
  const [kinPhone, setKinPhone] = useState("");
  const [consultFeeEnabled, setConsultFeeEnabled] = useState(true);
  const [consultFeeAmount, setConsultFeeAmount] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"CASH" | "INSURANCE">("CASH");
  const [providerId, setProviderId] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [reasonForVisit, setReasonForVisit] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [apptBusy, setApptBusy] = useState("");
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [formError, setFormError] = useState("");

  // Verification flow state
  const [verifyState, setVerifyState] = useState<VerifyState>("IDLE");
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [selectedBenefit, setSelectedBenefit] = useState<EligibilityBenefit | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [sandboxOtpHint, setSandboxOtpHint] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [ediAuthGuid, setEdiAuthGuid] = useState("");
  const [schemeName, setSchemeName] = useState("");
  const [schemeCode, setSchemeCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const activeVisits = visits.filter((v) => v.stage !== "COMPLETED");
  const atFinance = useMemo(
    () =>
      visits
        .filter((v) => v.stage === "AWAITING_PAYMENT")
        .slice()
        .sort(
          (a, b) =>
            new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime(),
        ),
    [visits],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fees = await api<FeeSchedule>("/billing/fees");
        if (cancelled) return;
        setConsultFeeEnabled(fees.consultationFeeEnabled !== false);
        setConsultFeeAmount(
          Number.isFinite(fees.consult) ? fees.consult : null,
        );
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const provider = insurers.find((p) => p.id === providerId);
  const today = new Date().toISOString().slice(0, 10);
  const checkedInApptIds = useMemo(
    () => new Set(visits.map((v) => v.appointmentId).filter(Boolean)),
    [visits],
  );
  const todaysAppointments = useMemo(
    () =>
      appointments.filter(
        (a) =>
          a.date === today &&
          ["SCHEDULED", "CONFIRMED"].includes(a.rawStatus || "") &&
          !checkedInApptIds.has(a.id),
      ),
    [appointments, today, checkedInApptIds],
  );

  const resetVerification = () => {
    setVerifyState("IDLE");
    setEligibility(null);
    setSelectedBenefit(null);
    setOtpCode("");
    setSandboxOtpHint("");
    setAuthCode("");
    setAuthToken("");
    setEdiAuthGuid("");
    setSchemeName("");
    setSchemeCode("");
    setErrorMessage("");
  };

  const checkEligibility = async () => {
    setVerifyState("CHECKING");
    setErrorMessage("");
    try {
      const data = await api<EligibilityResult>("/insurance/eligibility", {
        method: "POST",
        body: JSON.stringify({ providerId, memberNumber: policyNumber }),
      });
      if (!data.ok) {
        setErrorMessage(data.error ?? "Eligibility check failed.");
        setVerifyState("ERROR");
        return;
      }
      setEligibility(data);
      const first =
        data.benefits?.find((b) => b.status === "AVAILABLE") || data.benefits?.[0] || null;
      setSelectedBenefit(first);
      setVerifyState(data.requiresOtp ? "MEMBER_FOUND" : "MANUAL");
    } catch {
      setErrorMessage("Could not reach the insurance switch. Try again.");
      setVerifyState("ERROR");
    }
  };

  const sendOtp = async () => {
    if (!eligibility?.sessionId) return;
    setVerifyState("SENDING_OTP");
    setErrorMessage("");
    try {
      const data = await api<OtpSendResult>("/insurance/otp/send", {
        method: "POST",
        body: JSON.stringify({ providerId, sessionId: eligibility.sessionId }),
      });
      if (!data.ok) {
        setErrorMessage(data.error ?? "Could not send the code.");
        setVerifyState("ERROR");
        return;
      }
      setSandboxOtpHint(data.sandboxOtp || "");
      if (data.sandboxOtp) setOtpCode(data.sandboxOtp);
      setVerifyState("OTP_SENT");
    } catch {
      setErrorMessage("Could not reach the insurance switch. Try again.");
      setVerifyState("ERROR");
    }
  };

  const verifyOtp = async () => {
    if (!eligibility?.sessionId) return;
    setVerifyState("VERIFYING_OTP");
    setErrorMessage("");
    try {
      const data = await api<OtpVerifyResult>("/insurance/otp/verify", {
        method: "POST",
        body: JSON.stringify({
          providerId,
          sessionId: eligibility.sessionId,
          code: otpCode,
          benefitCode: selectedBenefit?.benefitCode,
          benefitType: selectedBenefit?.benefitType,
        }),
      });
      if (!data.verified) {
        setErrorMessage(data.error ?? "Verification failed.");
        setVerifyState("OTP_SENT");
        return;
      }
      setAuthCode(data.authorizationCode ?? data.authToken ?? data.ediAuthGuid ?? "");
      setAuthToken(data.authToken ?? data.authorizationCode ?? "");
      setEdiAuthGuid(data.ediAuthGuid ?? "");
      setSchemeName(data.schemeName || eligibility?.coverage?.scheme || "");
      setSchemeCode(data.schemeCode || "");
      setVerifyState("VERIFIED");
    } catch {
      setErrorMessage("Could not reach the insurance switch. Try again.");
      setVerifyState("ERROR");
    }
  };

  const resetForm = () => {
    setExistingId("");
    setSelectedPatient(null);
    setName("");
    setAge("");
    setGender("Female");
    setPhone("");
    setKinName("");
    setKinPhone("");
    setMethod("CASH");
    setProviderId("");
    setPolicyNumber("");
    setAppointmentId("");
    setReasonForVisit("");
    setAdditionalNotes("");
    setFormError("");
    resetVerification();
  };

  const submit = async () => {
    setFormError("");
    setCheckInBusy(true);
    try {
      let patient:
        | {
            patientName: string;
            mrn: string;
            age: number;
            gender: "Male" | "Female";
            phone: string;
          }
        | null = null;

      if (firstVisit) {
        if (!name.trim() || !phone.trim()) {
          setFormError("Name and phone are required for a first visit.");
          return;
        }
        const parts = name.trim().split(/\s+/);
        const firstName = parts[0] || name.trim();
        const lastName = parts.slice(1).join(" ") || firstName;
        try {
          const created = await api<{
            id: string;
            patient_number?: string;
            patientNumber?: string;
          }>("/ops/patients", {
            method: "POST",
            body: JSON.stringify({
              firstName,
              lastName,
              gender,
              phone,
              emergencyContactName: kinName.trim() || undefined,
              emergencyContactPhone: kinPhone.trim() || undefined,
            }),
          });
          const mrn = created.patient_number || created.patientNumber;
          if (!mrn) throw new Error("Patient created without MRN");
          patient = {
            patientName: name.trim(),
            mrn,
            age: Number(age) || 0,
            gender,
            phone,
          };
        } catch (err) {
          setFormError(
            err instanceof Error ? err.message : "Unable to register the patient",
          );
          return;
        }
      } else if (selectedPatient || existingId) {
        const existing = selectedPatient;
        if (!existing) {
          setFormError("Select a patient to continue.");
          return;
        }
        patient = {
          patientName: existing.name,
          mrn: existing.mrn,
          age: existing.age,
          gender: existing.gender === "Other" ? "Female" : existing.gender,
          phone: existing.phone,
        };
      }

      if (!patient || !patient.patientName) {
        setFormError("Select or register a patient first.");
        return;
      }

      await checkIn({
        ...patient,
        firstVisit,
        appointmentId: appointmentId || undefined,
        reasonForVisit: reasonForVisit.trim() || undefined,
        additionalNotes: additionalNotes.trim() || undefined,
        payment:
          method === "CASH"
            ? { method }
            : {
                method,
                provider: provider?.name,
                providerId,
                policyNumber,
                status: verifyState === "VERIFIED" ? "APPROVED" : "PENDING",
                memberName: eligibility?.member?.name,
                benefitBalance:
                  selectedBenefit?.balance ?? eligibility?.coverage?.balance,
                authorizationCode: authCode || undefined,
                authToken: authToken || undefined,
                ediAuthGuid: ediAuthGuid || undefined,
                benefitCode: selectedBenefit?.benefitCode,
                benefitType: selectedBenefit?.benefitType,
                schemeName: schemeName || eligibility?.coverage?.scheme,
                schemeCode: schemeCode || undefined,
              },
      });
      resetForm();
      void refreshAppointments();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to check the patient in",
      );
    } finally {
      setCheckInBusy(false);
    }
  };

  const checkInAppointment = async (appt: CatalogAppointment) => {
    if (!appt.mrn) return;
    setApptBusy(appt.id);
    try {
      await checkIn({
        patientName: appt.patient,
        mrn: appt.mrn,
        age: appt.age ?? 0,
        gender: appt.gender === "Male" ? "Male" : "Female",
        phone: appt.phone || "",
        firstVisit: false,
        appointmentId: appt.id,
        payment: { method: "CASH" },
      });
      void refreshAppointments();
    } finally {
      setApptBusy("");
    }
  };

  const canSubmit = firstVisit ? name.trim() !== "" : existingId !== "";
  // Slade / SHA API insurers must finish OTP (auth_token). Manual insurers may proceed pending.
  const insuranceReady =
    method === "CASH" ||
    verifyState === "VERIFIED" ||
    (verifyState === "MANUAL" && provider?.integration === "MANUAL");

  return (
    <RoleGuard module="front-desk">
      <PageHeader title="Front Desk" subtitle="Check patients in and send them to triage" />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="Patient Check-In" subtitle="Step 1 of the visit — reception" />
          <div className="space-y-5 px-5 pb-5">
            <div>
              <label className="text-xs font-semibold text-slate-600">
                Is this the patient&apos;s first visit?
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  { label: "Returning patient", value: false },
                  { label: "First visit", value: true },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setFirstVisit(opt.value)}
                    className={`rounded-full border px-3 py-2.5 text-sm font-medium transition ${
                      firstVisit === opt.value
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {firstVisit ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">Full name</label>
                  <input
                    className={`mt-1.5 ${inputClass}`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jane Wanjiku"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Age</label>
                  <input
                    className={`mt-1.5 ${inputClass}`}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="34"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Gender</label>
                  <select
                    className={`mt-1.5 ${inputClass}`}
                    value={gender}
                    onChange={(e) => setGender(e.target.value as "Male" | "Female")}
                  >
                    <option>Female</option>
                    <option>Male</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">Phone</label>
                  <input
                    className={`mt-1.5 ${inputClass}`}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+254 7…"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Next of kin
                  </label>
                  <input
                    className={`mt-1.5 ${inputClass}`}
                    value={kinName}
                    onChange={(e) => setKinName(e.target.value)}
                    placeholder="Relative name"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Kin phone</label>
                  <input
                    className={`mt-1.5 ${inputClass}`}
                    value={kinPhone}
                    onChange={(e) => setKinPhone(e.target.value)}
                    placeholder="+254 7…"
                  />
                </div>
              </div>
            ) : (
              <div>
                <FieldLabel required>Patient</FieldLabel>
                <PatientSearchSelect
                  value={existingId}
                  onChange={(id, patient) => {
                    setExistingId(id);
                    setSelectedPatient(patient ?? null);
                  }}
                  placeholder="Search by name, phone, or MRN…"
                  disabled={checkInBusy}
                />
              </div>
            )}

            <div>
              <FieldLabel required>How will this visit be paid?</FieldLabel>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["CASH", "INSURANCE"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMethod(m);
                      resetVerification();
                    }}
                    className={`rounded-full border px-3 py-2.5 text-sm font-medium transition ${
                      method === m
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {m === "CASH" ? "Cash / M-Pesa" : "Insurance"}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                {method === "CASH"
                  ? "Patient pays at billing (cash or M-Pesa) after clinical care."
                  : "Visit is billed to the insurer. Confirm eligibility below before sending to triage."}
              </p>
            </div>

            {method === "INSURANCE" && (
              <div className="space-y-4 rounded-2xl bg-[#f3f7f7] p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      Insurance provider
                    </label>
                    <select
                      className={`mt-1.5 ${inputClass}`}
                      value={providerId}
                      onChange={(e) => {
                        setProviderId(e.target.value);
                        resetVerification();
                      }}
                    >
                      <option value="">Select provider…</option>
                      {insurers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.mode === "live" ? " · live" : p.integration === "SLADE" ? " · sandbox" : ""}
                        </option>
                      ))}
                    </select>
                    {provider?.channel && (
                      <p className="mt-1 text-[10px] text-slate-400">{provider.channel}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      Member / policy number
                    </label>
                    <input
                      className={`mt-1.5 ${inputClass}`}
                      value={policyNumber}
                      onChange={(e) => {
                        setPolicyNumber(e.target.value);
                        resetVerification();
                      }}
                      placeholder={
                        provider?.integration === "SLADE" ? "e.g. DEMO/001" : "e.g. SHA-88231"
                      }
                    />
                  </div>
                </div>

                {(verifyState === "IDLE" ||
                  verifyState === "CHECKING" ||
                  verifyState === "ERROR") && (
                  <div className="space-y-2">
                    <button
                      onClick={checkEligibility}
                      disabled={!providerId || !policyNumber.trim() || verifyState === "CHECKING"}
                      className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {verifyState === "CHECKING" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                      {verifyState === "CHECKING" ? "Contacting switch…" : "Verify member"}
                    </button>
                    {errorMessage && (
                      <p className="text-[11px] font-medium text-rose-500">{errorMessage}</p>
                    )}
                  </div>
                )}

                {eligibility?.member &&
                  verifyState !== "IDLE" &&
                  verifyState !== "CHECKING" && (
                    <div className="flex items-center gap-3 rounded-xl bg-white p-3.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                        <UserCheck className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {eligibility.member.name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {eligibility.member.phoneMasked} · {eligibility.coverage?.scheme}
                          {eligibility.mode ? ` · ${eligibility.mode}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">
                          KES{" "}
                          {(
                            selectedBenefit?.balance ?? eligibility.coverage?.balance
                          )?.toLocaleString() ?? "—"}
                        </p>
                        <p className="text-[10px] text-slate-400">benefit balance</p>
                      </div>
                    </div>
                  )}

                {eligibility?.benefits &&
                  eligibility.benefits.length > 0 &&
                  (verifyState === "MEMBER_FOUND" ||
                    verifyState === "SENDING_OTP" ||
                    verifyState === "OTP_SENT" ||
                    verifyState === "VERIFYING_OTP") && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600">
                        Benefit to bill
                      </label>
                      <select
                        className={`mt-1.5 ${inputClass}`}
                        value={selectedBenefit?.benefitCode || ""}
                        onChange={(e) => {
                          const b =
                            eligibility.benefits?.find(
                              (x) => x.benefitCode === e.target.value,
                            ) || null;
                          setSelectedBenefit(b);
                        }}
                      >
                        {eligibility.benefits.map((b) => (
                          <option key={b.benefitCode || b.name} value={b.benefitCode || ""}>
                            {(b.name || b.benefitType || "Benefit") +
                              (b.benefitCode ? ` (${b.benefitCode})` : "") +
                              ` · ${b.status}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                {verifyState === "MEMBER_FOUND" || verifyState === "SENDING_OTP" ? (
                  <button
                    onClick={sendOtp}
                    disabled={verifyState === "SENDING_OTP"}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-40"
                  >
                    {verifyState === "SENDING_OTP" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Smartphone className="h-3.5 w-3.5" />
                    )}
                    {verifyState === "SENDING_OTP"
                      ? "Sending code…"
                      : "Send code to patient's phone"}
                  </button>
                ) : null}

                {(verifyState === "OTP_SENT" || verifyState === "VERIFYING_OTP") && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600">
                      Enter the OTP the patient received
                    </label>
                    {sandboxOtpHint && (
                      <p className="text-[11px] text-amber-700">
                        Sandbox OTP embedded in switch response:{" "}
                        <span className="font-mono font-semibold">{sandboxOtpHint}</span>
                      </p>
                    )}
                    <div className="flex gap-2">
                      <input
                        className={`${inputClass} max-w-40 text-center font-mono tracking-[0.3em]`}
                        value={otpCode}
                        onChange={(e) =>
                          setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 8))
                        }
                        placeholder="••••••"
                        inputMode="numeric"
                      />
                      <button
                        onClick={verifyOtp}
                        disabled={otpCode.length < 4 || verifyState === "VERIFYING_OTP"}
                        className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-40"
                      >
                        {verifyState === "VERIFYING_OTP" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Start visit
                      </button>
                    </div>
                    {errorMessage && (
                      <p className="text-[11px] font-medium text-rose-500">{errorMessage}</p>
                    )}
                  </div>
                )}

                {verifyState === "VERIFIED" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="teal">Member verified — visit authorized</Badge>
                    <span className="text-[10px] text-slate-400">
                      {ediAuthGuid
                        ? `GUID ${ediAuthGuid.slice(0, 18)}${ediAuthGuid.length > 18 ? "…" : ""}`
                        : `Auth ${authCode.slice(0, 18)}${authCode.length > 18 ? "…" : ""}`}
                    </span>
                  </div>
                )}

                {verifyState === "MANUAL" && (
                  <p className="text-[11px] text-slate-400">
                    {provider?.name} has no portal integration — cover will be confirmed manually
                    by billing and the visit proceeds as pending.
                  </p>
                )}
              </div>
            )}

            <div>
              <FieldLabel>Presenting context (administrative)</FieldLabel>
              <p className="mt-1 text-[11px] text-slate-400">
                Clinical reason for visit and chief complaint are captured at Triage.
              </p>
              <input
                className={`mt-1.5 ${inputClass}`}
                value={reasonForVisit}
                onChange={(e) => setReasonForVisit(e.target.value)}
                placeholder="e.g. Walk-in, referral, scheduled follow-up…"
                disabled={checkInBusy}
              />
            </div>

            <div>
              <FieldLabel>Reception notes (administrative)</FieldLabel>
              <textarea
                className={`mt-1.5 min-h-20 resize-y ${inputClass}`}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Administrative notes for triage / front desk (not a clinical assessment)…"
                disabled={checkInBusy}
              />
            </div>

            {formError && (
              <p className="text-sm text-rose-500">{formError}</p>
            )}

            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit || !insuranceReady || checkInBusy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {checkInBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {checkInBusy ? "Sending…" : "Send to Triage"}
            </button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="h-fit">
            <CardHeader
              title="Consultation fee"
              subtitle={
                consultFeeEnabled
                  ? `Auto-invoiced on cash check-in${
                      consultFeeAmount != null
                        ? ` · KES ${consultFeeAmount.toLocaleString()}`
                        : ""
                    }. Shown here until finance records payment.`
                  : "Consultation fees are turned off system-wide (free consultation day)."
              }
            />
            {!consultFeeEnabled ? (
              <p className="px-5 pb-5 text-sm text-slate-400">
                Patients go straight to triage after check-in. An admin can re-enable
                fees under Settings → General.
              </p>
            ) : atFinance.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-slate-400">
                No patients waiting for consultation-fee payment.
              </p>
            ) : (
              <ul className="space-y-2 px-5 pb-5">
                {atFinance.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/60 px-3.5 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={v.patientName} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {v.patientName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {v.billing?.invoiceNumber ?? "Draft invoice"}
                          {v.billing?.consultFeeAmount != null
                            ? ` · KES ${Number(v.billing.consultFeeAmount).toLocaleString()}`
                            : ""}{" "}
                          · awaiting payment
                        </p>
                      </div>
                    </div>
                    <Badge tone="amber">At finance</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="h-fit">
            <CardHeader
              title="Today's Appointments"
              subtitle={`${todaysAppointments.length} waiting to check in`}
            />
            <div className="space-y-2 px-5 pb-5">
              {todaysAppointments.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No scheduled appointments left for today.
                </p>
              ) : (
                todaysAppointments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[#f3f7f7] px-3.5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {a.patient}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                        {a.time} · {a.doctor} · {a.type}
                      </p>
                    </div>
                    <button
                      onClick={() => void checkInAppointment(a)}
                      disabled={apptBusy === a.id}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-40"
                    >
                      {apptBusy === a.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="h-3.5 w-3.5" />
                      )}
                      Check in
                    </button>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="h-fit">
            <CardHeader
              title="Today's Patient Flow"
              subtitle={`${activeVisits.length} active visit${activeVisits.length === 1 ? "" : "s"}`}
            />
            <VisitQueueList
              visits={activeVisits}
              onSelect={() => {}}
              emptyMessage="No active visits yet — check a patient in to start the flow."
            />
          </Card>
        </div>
      </div>
    </RoleGuard>
  );
}
