"use client";

import {
  ChevronLeft,
  CreditCard,
  FolderOpen,
  History,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui";
import { api } from "@/lib/api";
import type { PatientDetail } from "@/lib/catalog";

type Tab = "personal" | "timeline";

const STATUS_TONES: Record<string, BadgeTone> = {
  Pending: "amber",
  Scheduled: "blue",
  "Checked In": "teal",
  Completed: "green",
  Cancelled: "red",
  CHECKED_IN: "teal",
  WAITING_DOCTOR: "amber",
  IN_CONSULTATION: "blue",
  COMPLETED: "green",
  IN_PROGRESS: "amber",
};

export function PatientQuickViewModal({
  patientId,
  onClose,
}: {
  patientId: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("personal");
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api<PatientDetail>(`/catalog/patients/${patientId}`);
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load patient");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const timeline = useMemo(() => {
    if (!detail) return [];
    if (detail.visitTimeline?.length) return detail.visitTimeline;
    return [
      ...detail.appointments.map((a) => ({
        id: a.id,
        kind: "appointment" as const,
        label: a.appointmentNumber,
        date: a.date,
        time: a.time,
        when: `${a.date}T${a.time}`,
        provider: a.provider,
        status: a.status,
        summary: "",
        href: `/appointments/${a.id}`,
      })),
      ...detail.consultations.map((c) => ({
        id: c.id,
        kind: "consultation" as const,
        label: "Consultation",
        date: c.date.slice(0, 10),
        time: "",
        when: c.date,
        provider: c.physician,
        status: c.status,
        summary: c.diagnosis,
        href: `/patients/${detail.id}`,
      })),
    ];
  }, [detail]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
      <div className="flex max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-slate-100 bg-[#faf7f9]">
          <div className="px-4 pb-3 pt-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
              Diagnostic overview
            </p>
            <h2 className="mt-1 text-base font-bold leading-snug text-slate-900">
              {detail?.name ?? "Patient"}
            </h2>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-2">
            {(
              [
                { id: "personal", label: "Personal Data", icon: CreditCard },
                { id: "timeline", label: "Visit Timeline", icon: History },
              ] as const
            ).map((item) => {
              const active = tab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    active
                      ? "bg-white font-semibold text-brand-700 shadow-sm ring-1 ring-brand-100"
                      : "font-medium text-slate-600 hover:bg-white/70"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${active ? "text-brand-600" : "text-slate-400"}`}
                  />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={onClose}
            className="m-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to List
          </button>
        </aside>

        <div className="relative min-w-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 text-slate-400 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>

          {loading && <p className="text-sm text-slate-400">Loading patient…</p>}
          {error && <p className="text-sm text-rose-500">{error}</p>}

          {detail && !loading && tab === "personal" && (
            <div className="space-y-5 pr-4">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
                    Demographics registry
                  </p>
                  <dl className="mt-3 space-y-3 text-sm">
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                        Full identity
                      </dt>
                      <dd className="font-semibold text-slate-900">{detail.name}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                        Biological gender
                      </dt>
                      <dd className="font-semibold text-slate-900">
                        {detail.gender || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                        Current age
                      </dt>
                      <dd className="font-semibold text-slate-900">
                        {detail.age > 0 ? `${detail.age} Years` : "N/A Years"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                        Blood profile
                      </dt>
                      <dd className="mt-1">
                        <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-600">
                          {detail.bloodGroup || "N/A"}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
                    Communication matrix
                  </p>
                  <dl className="mt-3 space-y-3 text-sm">
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                        Direct phone
                      </dt>
                      <dd className="font-semibold text-slate-900">
                        {detail.phone || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                        Email reach
                      </dt>
                      <dd className="truncate font-semibold text-slate-900">
                        {detail.email || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                        Residential address
                      </dt>
                      <dd className="font-medium text-slate-700">
                        {detail.address || "Address not recorded in system"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="rounded-xl bg-brand-50 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
                  Emergency response (NOK)
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-900">
                  <Users className="h-4 w-4 text-brand-600" />
                  {detail.emergencyContact?.name || "Not registered"}
                </div>
                {detail.emergencyContact?.phone && (
                  <p className="mt-1 text-xs text-slate-600">
                    {detail.emergencyContact.relationship} ·{" "}
                    {detail.emergencyContact.phone}
                  </p>
                )}
              </div>

              <Link
                href={`/patients/${detail.id}`}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:border-brand-300 hover:text-brand-700"
              >
                Open full profile
              </Link>
            </div>
          )}

          {detail && !loading && tab === "timeline" && (
            <div className="pr-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
                Historical encounters
              </p>
              {timeline.length === 0 ? (
                <div className="mt-4 flex min-h-48 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-6 text-center">
                  <FolderOpen className="mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    No historical encounters detected
                  </p>
                </div>
              ) : (
                <ul className="mt-4 space-y-2">
                  {timeline.slice(0, 20).map((item) => (
                    <li key={`${item.kind}-${item.id}`}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className="block rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-sm transition hover:border-brand-200 hover:bg-brand-50/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-slate-800">
                            {item.label}
                            {item.date ? ` · ${item.date}` : ""}
                            {item.time ? ` ${item.time}` : ""}
                          </p>
                          <Badge tone={STATUS_TONES[item.status] ?? "slate"}>
                            {item.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500">
                          {item.provider}
                          {item.summary ? ` · ${item.summary}` : ""}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
