"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  Timer,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  PageHeader,
  PrimaryButton,
  StatCard,
  StatCardSkeleton,
  type BadgeTone,
} from "@/components/ui";
import { api } from "@/lib/api";

type OutpatientQueueItem = {
  visitId: string;
  mrn: string;
  patientName: string;
  testCount: number;
  requestId: string | null;
  requestNumber: string | null;
  requestStatus: string | null;
  released: boolean;
  badge: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "RELEASED";
};

type LabOverview = {
  activeTestTypes: number;
  pendingRequests: number;
  urgentRequests: number;
  statRequests: number;
  samplesRegistered: number;
  samplesAwaitingProcessing: number;
  resultsAwaitingVerification: number;
  criticalUnverified: number;
  todaysCompleted: number;
  outpatientQueue?: OutpatientQueueItem[];
};

const BADGE_TONE: Record<OutpatientQueueItem["badge"], BadgeTone> = {
  PENDING: "amber",
  IN_PROGRESS: "teal",
  COMPLETED: "blue",
  RELEASED: "green",
};

const BADGE_LABEL: Record<OutpatientQueueItem["badge"], string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed — send to doctor",
  RELEASED: "Released",
};

export default function LaboratoryOverviewPage() {
  const [data, setData] = useState<LabOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<LabOverview>("/laboratory/overview"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load laboratory board");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visitQueue = data?.outpatientQueue ?? [];

  const stats = data
    ? [
        { label: "Active test types", value: data.activeTestTypes, icon: FlaskConical },
        { label: "Pending requests", value: data.pendingRequests, icon: ClipboardList },
        { label: "Urgent", value: data.urgentRequests, icon: Timer },
        { label: "STAT", value: data.statRequests, icon: Zap },
        { label: "Samples registered", value: data.samplesRegistered, icon: Activity },
        { label: "Samples in process", value: data.samplesAwaitingProcessing, icon: Activity },
        { label: "Awaiting verification", value: data.resultsAwaitingVerification, icon: CheckCircle2 },
        { label: "Critical unverified", value: data.criticalUnverified, icon: AlertTriangle },
        { label: "Completed today", value: data.todaysCompleted, icon: CheckCircle2 },
      ]
    : [];

  return (
    <RoleGuard module="laboratory">
      <PageHeader
        title="Laboratory"
        subtitle={loading ? "Loading board…" : "Requests, samples, and results"}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/laboratory/requests">
              <PrimaryButton>Requests</PrimaryButton>
            </Link>
            <Link href="/laboratory/results">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
              >
                Results
              </button>
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
            >
              Refresh
            </button>
          </div>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {loading &&
          Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)}
        {!loading &&
          stats.map((s) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={String(s.value)}
              icon={s.icon}
              deltaLabel="live board"
            />
          ))}
      </div>

      {data && data.criticalUnverified > 0 && (
        <Card className="mb-5 border border-rose-200 bg-rose-50/40 p-4">
          <p className="text-sm font-semibold text-rose-700">
            {data.criticalUnverified} critical result
            {data.criticalUnverified === 1 ? "" : "s"} awaiting verification
          </p>
          <Link
            href="/laboratory/results?critical=1"
            className="mt-1 inline-block text-xs font-medium text-rose-600 underline"
          >
            Review critical results
          </Link>
        </Card>
      )}

      {visitQueue.length > 0 && (
        <Card className="mb-5">
          <CardHeader
            title="Outpatient lab queue"
            subtitle="Patients waiting after consultation — open the linked request to collect samples and enter results"
          />
          <ul className="space-y-3 px-5 pb-5">
            {visitQueue.map((v) => (
              <li
                key={v.visitId}
                className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#f3f7f7] p-4"
              >
                <Avatar name={v.patientName} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{v.patientName}</p>
                  <p className="text-[11px] text-slate-400">
                    {v.mrn} · {v.testCount} test(s)
                    {v.requestNumber ? ` · ${v.requestNumber}` : ""}
                  </p>
                </div>
                <Badge tone={BADGE_TONE[v.badge]}>{BADGE_LABEL[v.badge]}</Badge>
                <Link
                  href={
                    v.requestId
                      ? `/laboratory/requests/${v.requestId}`
                      : `/laboratory/requests?search=${encodeURIComponent(v.mrn)}`
                  }
                  className="rounded-full bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Open request
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/laboratory/test-types", label: "Test Types", hint: "Panels & parameters" },
          {
            href: "/laboratory/services",
            label: "Services & Procedures",
            hint: "Vaccines, procedures, surgeries",
          },
          { href: "/laboratory/requests", label: "Requests", hint: "Order & track" },
          { href: "/laboratory/samples", label: "Samples", hint: "Collection lifecycle" },
          { href: "/laboratory/results", label: "Results", hint: "Entry & verification" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(23,40,46,0.05)] hover:border-brand-200"
          >
            <p className="font-semibold text-slate-800">{l.label}</p>
            <p className="mt-1 text-xs text-slate-400">{l.hint}</p>
          </Link>
        ))}
      </div>
    </RoleGuard>
  );
}
