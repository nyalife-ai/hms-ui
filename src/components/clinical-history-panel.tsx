"use client";

import { FolderOpen, History } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Badge, Card, CardHeader, type BadgeTone } from "@/components/ui";
import { api } from "@/lib/api";
import type { PatientDetail } from "@/lib/catalog";
import { consultationJourneyHref } from "@/lib/clinical-links";

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
  SCHEDULED: "blue",
};

type TimelineItem = NonNullable<PatientDetail["visitTimeline"]>[number];

function itemHref(item: TimelineItem, patientId: string): string {
  if (item.href?.startsWith("/consultations/")) return item.href;
  if (item.kind === "visit" && item.id) {
    return consultationJourneyHref(item.id);
  }
  if (item.kind === "consultation") {
    if (item.visitId) return consultationJourneyHref(item.visitId);
    if (item.href) return item.href;
    return `/patients/${patientId}?consultationId=${item.id}`;
  }
  return item.href || `/patients/${patientId}`;
}

/**
 * Compact clinical history for doctor/admin workflows.
 * Reuses catalog patient detail (visitTimeline + consultations).
 */
export function ClinicalHistoryPanel({
  patientId,
  currentVisitId,
  className,
}: {
  patientId: string;
  currentVisitId?: string;
  className?: string;
}) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const detail = await api<PatientDetail>(
          `/catalog/patients/${patientId}`,
        );
        if (cancelled) return;
        const timeline =
          detail.visitTimeline?.length
            ? detail.visitTimeline
            : [
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
                  href:
                    c.href ||
                    (c.visitId
                      ? consultationJourneyHref(c.visitId)
                      : `/patients/${detail.id}?consultationId=${c.id}`),
                  visitId: c.visitId ?? null,
                  appointmentId: c.appointmentId ?? null,
                })),
              ];
        setItems(
          timeline.filter(
            (t) => !(currentVisitId && t.kind === "visit" && t.id === currentVisitId),
          ),
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load clinical history",
          );
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId, currentVisitId]);

  return (
    <Card className={className}>
      <CardHeader
        title="Clinical History"
        subtitle="Previous visits, consultations, and appointments"
        action={
          <Link
            href={`/patients/${patientId}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
          >
            <History className="h-3.5 w-3.5" /> Full patient record
          </Link>
        }
      />
      <div className="px-5 pb-5">
        {loading && (
          <div className="flex min-h-28 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          </div>
        )}
        {error && !loading && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
            <button
              type="button"
              className="ml-2 font-semibold underline"
              onClick={() => {
                setLoading(true);
                setError("");
                void api<PatientDetail>(`/catalog/patients/${patientId}`)
                  .then((detail) => {
                    setItems(detail.visitTimeline ?? []);
                  })
                  .catch((err) =>
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Unable to load clinical history",
                    ),
                  )
                  .finally(() => setLoading(false));
              }}
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <EmptyState
            icon={FolderOpen}
            title="No prior clinical history"
            description="This patient has no earlier visits or consultations on file."
            className="min-h-28"
          />
        )}
        {!loading && !error && items.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {items.slice(0, 12).map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {item.label}
                    {item.summary ? (
                      <span className="font-normal text-slate-500">
                        {" "}
                        · {item.summary}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-400">
                    {item.date}
                    {item.time ? ` · ${item.time}` : ""}
                    {item.provider ? ` · ${item.provider}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={STATUS_TONES[item.status] ?? "slate"}>
                    {String(item.status).replace(/_/g, " ")}
                  </Badge>
                  <Link
                    href={itemHref(item, patientId)}
                    className="text-xs font-semibold text-brand-700 hover:underline"
                  >
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
