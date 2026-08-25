"use client";

import { FieldLabel } from "@/components/field-label";

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

export type PatientFormGender = "Male" | "Female" | "Other";

export type PatientFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: PatientFormGender;
  dateOfBirth: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  bloodGroup: string;
  occupation: string;
  maritalStatus: string;
  allergies: string;
  chronicDiseases: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

export const EMPTY_PATIENT_FORM: PatientFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  gender: "Female",
  dateOfBirth: "",
  address: "",
  city: "",
  country: "",
  postalCode: "",
  bloodGroup: "",
  occupation: "",
  maritalStatus: "",
  allergies: "",
  chronicDiseases: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
};

/** Map UI gender → patients module DTO (MALE/FEMALE/OTHER). */
export function toPatientsApiGender(
  g: PatientFormGender,
): "MALE" | "FEMALE" | "OTHER" {
  if (g === "Male") return "MALE";
  if (g === "Female") return "FEMALE";
  return "OTHER";
}

/** Build POST /ops/patients body (Male/Female/Other). */
export function toOpsCreateBody(values: PatientFormValues) {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    gender: values.gender,
    phone: values.phone.trim() || undefined,
    email: values.email.trim() || undefined,
    dateOfBirth: values.dateOfBirth || undefined,
    address: values.address.trim() || undefined,
    city: values.city.trim() || undefined,
    country: values.country.trim() || undefined,
    postalCode: values.postalCode.trim() || undefined,
    bloodGroup: values.bloodGroup || undefined,
    occupation: values.occupation.trim() || undefined,
    maritalStatus: values.maritalStatus || undefined,
    allergies: values.allergies.trim() || undefined,
    chronicDiseases: values.chronicDiseases.trim() || undefined,
    emergencyContactName: values.emergencyContactName.trim() || undefined,
    emergencyContactPhone: values.emergencyContactPhone.trim() || undefined,
  };
}

/** Build PATCH /patients/:id body. */
export function toPatientsUpdateBody(values: PatientFormValues) {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phone: values.phone.trim() || undefined,
    email: values.email.trim() || undefined,
    gender: toPatientsApiGender(values.gender),
    dateOfBirth: values.dateOfBirth || undefined,
    address: values.address.trim() || undefined,
    city: values.city.trim() || undefined,
    country: values.country.trim() || undefined,
    postalCode: values.postalCode.trim() || undefined,
    bloodGroup: values.bloodGroup || undefined,
    occupation: values.occupation.trim() || undefined,
    maritalStatus: values.maritalStatus || undefined,
    allergies: values.allergies.trim() || undefined,
    chronicDiseases: values.chronicDiseases.trim() || undefined,
    emergencyContactName: values.emergencyContactName.trim() || undefined,
    emergencyContactPhone: values.emergencyContactPhone.trim() || undefined,
  };
}

export function validatePatientForm(
  values: PatientFormValues,
  opts?: { requirePhone?: boolean },
): string | null {
  if (!values.firstName.trim() || !values.lastName.trim()) {
    return "First name and last name are required.";
  }
  if (opts?.requirePhone !== false && !values.phone.trim()) {
    return "Phone is required.";
  }
  return null;
}

const BLOOD = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
const MARITAL = ["", "SINGLE", "MARRIED", "DIVORCED", "WIDOWED"] as const;

export function PatientForm({
  values,
  onChange,
  mode = "create",
  insurance,
}: {
  values: PatientFormValues;
  onChange: (next: PatientFormValues) => void;
  mode?: "create" | "edit";
  insurance?: Array<{ providerName: string; memberId: string; status: string }>;
}) {
  const set = <K extends keyof PatientFormValues>(
    key: K,
    value: PatientFormValues[K],
  ) => onChange({ ...values, [key]: value });

  return (
    <div className="space-y-5">
      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-brand-600">
          Personal
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel required>First name</FieldLabel>
            <input
              className={inputClass}
              value={values.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              autoComplete="given-name"
            />
          </div>
          <div>
            <FieldLabel required>Last name</FieldLabel>
            <input
              className={inputClass}
              value={values.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              autoComplete="family-name"
            />
          </div>
          <div>
            <FieldLabel required>Gender</FieldLabel>
            <select
              className={inputClass}
              value={values.gender}
              onChange={(e) =>
                set("gender", e.target.value as PatientFormGender)
              }
            >
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <FieldLabel optional>Date of birth</FieldLabel>
            <input
              className={inputClass}
              type="date"
              value={values.dateOfBirth}
              onChange={(e) => set("dateOfBirth", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-brand-600">
          Contact
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel required={mode === "create"}>Phone</FieldLabel>
            <input
              className={inputClass}
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
              autoComplete="tel"
            />
          </div>
          <div>
            <FieldLabel optional>Email</FieldLabel>
            <input
              className={inputClass}
              type="email"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel optional>Address</FieldLabel>
            <input
              className={inputClass}
              value={values.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel optional>City</FieldLabel>
            <input
              className={inputClass}
              value={values.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel optional>Country</FieldLabel>
            <input
              className={inputClass}
              value={values.country}
              onChange={(e) => set("country", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel optional>Postal code</FieldLabel>
            <input
              className={inputClass}
              value={values.postalCode}
              onChange={(e) => set("postalCode", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-brand-600">
          Emergency / next of kin
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel optional>Contact name</FieldLabel>
            <input
              className={inputClass}
              value={values.emergencyContactName}
              onChange={(e) => set("emergencyContactName", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel optional>Contact phone</FieldLabel>
            <input
              className={inputClass}
              value={values.emergencyContactPhone}
              onChange={(e) => set("emergencyContactPhone", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-brand-600">
          Demographics
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel optional>Blood group</FieldLabel>
            <select
              className={inputClass}
              value={values.bloodGroup}
              onChange={(e) => set("bloodGroup", e.target.value)}
            >
              {BLOOD.map((b) => (
                <option key={b || "none"} value={b}>
                  {b || "—"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel optional>Marital status</FieldLabel>
            <select
              className={inputClass}
              value={values.maritalStatus}
              onChange={(e) => set("maritalStatus", e.target.value)}
            >
              {MARITAL.map((m) => (
                <option key={m || "none"} value={m}>
                  {m || "—"}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <FieldLabel optional>Occupation</FieldLabel>
            <input
              className={inputClass}
              value={values.occupation}
              onChange={(e) => set("occupation", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-brand-600">
          Clinical
        </p>
        <div className="space-y-3">
          <div>
            <FieldLabel optional>Allergies</FieldLabel>
            <input
              className={inputClass}
              value={values.allergies}
              onChange={(e) => set("allergies", e.target.value)}
              placeholder="e.g. Penicillin"
            />
          </div>
          <div>
            <FieldLabel optional>Chronic diseases</FieldLabel>
            <input
              className={inputClass}
              value={values.chronicDiseases}
              onChange={(e) => set("chronicDiseases", e.target.value)}
              placeholder="e.g. Hypertension, Diabetes"
            />
          </div>
        </div>
      </section>

      {insurance && insurance.length > 0 && (
        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-brand-600">
            Insurance
          </p>
          <ul className="space-y-2 text-sm">
            {insurance.map((pol, i) => (
              <li
                key={`${pol.providerName}-${i}`}
                className="rounded-xl border border-border bg-surface-200 px-3 py-2"
              >
                <span className="font-medium text-foreground">
                  {pol.providerName}
                </span>
                {pol.memberId ? (
                  <span className="text-foreground-light"> · {pol.memberId}</span>
                ) : null}
                <span className="ml-2 text-xs text-foreground-lighter">{pol.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
