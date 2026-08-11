"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type HospitalSettings = {
  name: string;
  phone: string;
  email: string;
  address: string;
  timezone: string;
};

const DEFAULTS: HospitalSettings = {
  name: "NyaLife Women's Health Clinic",
  phone: "",
  email: "",
  address: "",
  timezone: "Africa/Nairobi",
};

let cached: HospitalSettings | null = null;
let inflight: Promise<HospitalSettings> | null = null;

export async function fetchHospitalSettings(): Promise<HospitalSettings> {
  if (cached) return cached;
  if (!inflight) {
    inflight = api<HospitalSettings>("/ops/settings/hospital")
      .then((data) => {
        cached = {
          name: data.name?.trim() || DEFAULTS.name,
          phone: data.phone ?? "",
          email: data.email ?? "",
          address: data.address ?? "",
          timezone: data.timezone || DEFAULTS.timezone,
        };
        return cached;
      })
      .catch(() => {
        cached = DEFAULTS;
        return cached;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useHospitalSettings() {
  const [hospital, setHospital] = useState<HospitalSettings>(cached ?? DEFAULTS);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let cancelled = false;
    void fetchHospitalSettings().then((data) => {
      if (!cancelled) {
        setHospital(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { hospital, loading };
}

/** Strip journal / internal meta tags from invoice notes for patient-facing print. */
export function cleanPrintNotes(notes: string | null | undefined): string {
  if (!notes) return "";
  return notes
    .replace(/\[\[je:[^\]]+\]\]/gi, "")
    .replace(/\[\[taxRateId:[^\]]+\]\]/gi, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
