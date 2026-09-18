"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  ScanLine,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import {
  Card,
  CardHeader,
  PageHeader,
  StatCard,
  StatCardSkeleton,
} from "@/components/ui";
import { api } from "@/lib/api";

type RadiologyOverview = {
  activeScanTypes: number;
  todaysCompleted: number;
  urgentOutstanding: number;
  pending: number;
  scheduled: number;
  checkedIn: number;
  inProgress: number;
  completed: number;
  reportPending: number;
  reported: number;
  finalized: number;
  cancelled: number;
  noShow: number;
};

export default function RadiologyOverviewPage() {
  const [data, setData] = useState<RadiologyOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<RadiologyOverview>("/imaging/overview"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load radiology overview");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = data
    ? [
        { label: "Active scan types", value: data.activeScanTypes, icon: ScanLine },
        { label: "Completed today", value: data.todaysCompleted, icon: CheckCircle2 },
        { label: "Urgent/STAT outstanding", value: data.urgentOutstanding, icon: AlertTriangle },
        { label: "Awaiting report", value: data.reportPending, icon: FileText },
      ]
    : [];

  const pipeline = data
    ? [
        { label: "Pending", value: data.pending, tone: "bg-surface-200" },
        { label: "Scheduled", value: data.scheduled, tone: "bg-sky-100" },
        { label: "Checked in", value: data.checkedIn, tone: "bg-sky-100" },
        { label: "In progress", value: data.inProgress, tone: "bg-amber-100" },
        { label: "Completed", value: data.completed, tone: "bg-amber-100" },
        { label: "Report pending", value: data.reportPending, tone: "bg-amber-100" },
        { label: "Reported", value: data.reported, tone: "bg-emerald-100" },
        { label: "Finalized", value: data.finalized, tone: "bg-emerald-100" },
        { label: "Cancelled", value: data.cancelled, tone: "bg-rose-100" },
        { label: "No-show", value: data.noShow, tone: "bg-rose-100" },
      ]
    : [];

  return (
    <RoleGuard module="radiology">
      <PageHeader
        title="Radiology"
        subtitle={loading ? "Loading radiology overview…" : "Imaging worklist, requests, and reporting"}
        action={
          <div className="flex gap-2">
            <Link
              href="/radiology/requests"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground-light hover:border-brand-300"
            >
              <ClipboardList className="h-4 w-4" />
              Requests
            </Link>
            <Link
              href="/radiology/scan-types"
              className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              <ScanLine className="h-4 w-4" />
              Scan types
            </Link>
          </div>
        }
      />

      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {loading &&
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        {!loading &&
          stats.map((s) => (
            <StatCard key={s.label} label={s.label} value={String(s.value)} icon={s.icon} />
          ))}
      </div>

      <Card>
        <CardHeader
          title="Request pipeline"
          subtitle="Counts across the full lifecycle"
          action={
            <Link
              href="/radiology/requests"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
            >
              <CalendarClock className="h-4 w-4" />
              Open worklist
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-5">
          {pipeline.map((p) => (
            <div key={p.label} className={`rounded-xl ${p.tone} px-3 py-2.5 text-center`}>
              <p className="text-xl font-bold text-foreground">{p.value}</p>
              <p className="text-[11px] text-foreground-light">{p.label}</p>
            </div>
          ))}
        </div>
      </Card>
    </RoleGuard>
  );
}
