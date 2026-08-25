"use client";

import {
  AlertTriangle,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  Plus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FieldLabel } from "@/components/field-label";
import { FollowUpRowActions } from "@/components/follow-up-row-actions";
import { PaginationBar } from "@/components/pagination-bar";
import { PatientSearchSelect } from "@/components/patient-search-select";
import { RoleGuard } from "@/components/role-guard";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  PageHeader,
  PrimaryButton,
  StatCard,
  Table,
  type BadgeTone,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { usePaginatedCatalog } from "@/lib/catalog";
import { consultationJourneyHref } from "@/lib/clinical-links";
import { toPageMeta, unwrapPage } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const STATUS_TONES: Record<string, BadgeTone> = {
  SCHEDULED: "blue",
  COMPLETED: "green",
  CANCELLED: "red",
  NO_SHOW: "amber",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type ViewMode = "list" | "calendar";
type CalendarMode = "month" | "week" | "day";

type FollowUpRow = {
  id: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  consultationId: string;
  appointmentId: string | null;
  /** Outpatient visit id for doctor journey `/consultations/:visitId` */
  visitId?: string | null;
  doctorId: string;
  doctorName: string;
  followUpDate: string;
  followUpType: string | null;
  reason: string;
  status: string;
  notes: string | null;
};

function hasLinkedConsultation(row: FollowUpRow): boolean {
  return Boolean(row.visitId || row.appointmentId || row.consultationId);
}

type FollowUpSummary = {
  scheduledThisMonth: number;
  completedThisMonth: number;
  dueWithin7Days: number;
  overdue: number;
};

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function monthGrid(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function formatDate(v: string | null | undefined) {
  if (!v) return "—";
  try {
    return new Date(`${v.slice(0, 10)}T12:00:00`).toLocaleDateString();
  } catch {
    return String(v);
  }
}

export default function FollowUpsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canSchedule =
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN" ||
    user?.role === "DOCTOR" ||
    user?.role === "RECEPTIONIST";

  const [view, setView] = useState<ViewMode>("list");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("month");
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const search = useDebouncedValue(searchInput, 400);

  const [summary, setSummary] = useState<FollowUpSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const listParams = useMemo(
    () => ({
      page,
      limit: 50,
      search: search || undefined,
      status: statusFilter || undefined,
      from: selectedDate || undefined,
      to: selectedDate || undefined,
    }),
    [page, search, statusFilter, selectedDate],
  );

  const {
    items: rows,
    total,
    limit,
    loading,
    error,
    refresh,
  } = usePaginatedCatalog<FollowUpRow>("/follow-ups", listParams);

  const calendarRange = useMemo(() => {
    if (calendarMode === "month") {
      const days = monthGrid(cursor);
      return { from: toYmd(days[0]), to: toYmd(days[41]) };
    }
    if (calendarMode === "week") {
      const start = startOfWeek(cursor);
      return { from: toYmd(start), to: toYmd(addDays(start, 6)) };
    }
    const day = selectedDate ? new Date(`${selectedDate}T12:00:00`) : cursor;
    const ymd = toYmd(day);
    return { from: ymd, to: ymd };
  }, [calendarMode, cursor, selectedDate]);

  const [calendarItems, setCalendarItems] = useState<FollowUpRow[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const loadCalendar = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const qs = new URLSearchParams({
        page: "1",
        limit: "500",
        from: calendarRange.from,
        to: calendarRange.to,
      });
      if (search) qs.set("search", search);
      if (statusFilter) qs.set("status", statusFilter);
      const res = unwrapPage<FollowUpRow>(await api(`/follow-ups?${qs.toString()}`));
      setCalendarItems(res.items);
    } catch {
      setCalendarItems([]);
    } finally {
      setCalendarLoading(false);
    }
  }, [calendarRange.from, calendarRange.to, search, statusFilter]);

  useEffect(() => {
    if (view === "calendar") void loadCalendar();
  }, [view, loadCalendar]);

  const byDate = useMemo(() => {
    const map = new Map<string, FollowUpRow[]>();
    for (const row of calendarItems) {
      const key = row.followUpDate?.slice(0, 10);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return map;
  }, [calendarItems]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      setSummary(await api<FollowUpSummary>("/follow-ups/summary"));
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [patientId, setPatientId] = useState("");
  const [followUpDate, setFollowUpDate] = useState(toYmd(new Date()));
  const [reason, setReason] = useState("");
  const [followUpType, setFollowUpType] = useState("Review");
  const [notes, setNotes] = useState("");

  const [quickView, setQuickView] = useState<FollowUpRow | null>(null);
  const [notice, setNotice] = useState("");

  const refreshAll = async () => {
    await Promise.all([
      refresh(),
      loadSummary(),
      view === "calendar" ? loadCalendar() : Promise.resolve(),
    ]);
  };

  const schedule = async () => {
    if (!patientId) {
      setFormError("Select a patient.");
      return;
    }
    if (!reason.trim()) {
      setFormError("Reason is required.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api("/follow-ups", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          followUpDate,
          reason: reason.trim(),
          followUpType: followUpType.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      setOpen(false);
      setPatientId("");
      setReason("");
      setNotes("");
      setNotice("Follow-up scheduled.");
      await refreshAll();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not schedule follow-up");
    } finally {
      setBusy(false);
    }
  };

  const markComplete = async (id: string) => {
    setBusy(true);
    try {
      await api(`/follow-ups/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      setNotice("Follow-up marked complete.");
      await refreshAll();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not update follow-up");
    } finally {
      setBusy(false);
    }
  };

  /** Prefer visit journey (consultation UI), then appointment, then patient. */
  const openLinkedConsultation = (row: FollowUpRow) => {
    if (row.visitId) {
      router.push(consultationJourneyHref(row.visitId));
      return;
    }
    if (row.appointmentId) {
      router.push(`/appointments/${row.appointmentId}`);
      return;
    }
    if (row.consultationId && row.patientId) {
      router.push(
        `/patients/${row.patientId}?consultationId=${row.consultationId}`,
      );
      return;
    }
  };

  const openDetailed = (row: FollowUpRow) => {
    setQuickView(row);
  };

  const selectDay = (ymd: string) => {
    setSelectedDate((prev) => (prev === ymd ? null : ymd));
    setPage(1);
  };

  const meta = toPageMeta({ total, page, limit });
  const todayYmd = toYmd(new Date());
  const kpi = summary ?? {
    scheduledThisMonth: 0,
    completedThisMonth: 0,
    dueWithin7Days: 0,
    overdue: 0,
  };

  return (
    <RoleGuard module="follow-ups">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-foreground-lighter">
        Home / Follow-ups
      </div>
      <PageHeader
        title="Follow-ups"
        subtitle={
          selectedDate
            ? `Filtered to ${selectedDate} · click the day again to clear`
            : "Scheduled reviews after consultation — list and calendar"
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-border bg-white p-0.5">
              <button
                type="button"
                onClick={() => setView("list")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  view === "list"
                    ? "bg-slate-900 text-white"
                    : "text-foreground-light hover:text-foreground"
                }`}
              >
                <LayoutList className="h-3.5 w-3.5" /> List view
              </button>
              <button
                type="button"
                onClick={() => setView("calendar")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  view === "calendar"
                    ? "bg-slate-900 text-white"
                    : "text-foreground-light hover:text-foreground"
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" /> Calendar view
              </button>
            </div>
            {canSchedule ? (
              <PrimaryButton onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> Schedule follow-up
              </PrimaryButton>
            ) : null}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Scheduled this month"
          value={summaryLoading ? "…" : String(kpi.scheduledThisMonth)}
          deltaLabel="on the books"
          icon={CalendarClock}
        />
        <StatCard
          label="Completed this month"
          value={summaryLoading ? "…" : String(kpi.completedThisMonth)}
          deltaLabel="reviews done"
          icon={CheckCircle2}
        />
        <StatCard
          label="Due within 7 days"
          value={summaryLoading ? "…" : String(kpi.dueWithin7Days)}
          deltaLabel="coming up"
          icon={CalendarCheck2}
        />
        <StatCard
          label="Overdue"
          value={summaryLoading ? "…" : String(kpi.overdue)}
          deltaLabel="past due date"
          icon={AlertTriangle}
        />
      </div>

      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      {notice && (
        <p className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">{notice}</p>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className={`min-w-[220px] flex-1 ${inputClass}`}
          placeholder="Search by patient or reason..."
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={`w-44 ${inputClass}`}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"].map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {view === "list" ? (
        <Card>
          <CardHeader
            title="Follow-up registry"
            subtitle={`${total.toLocaleString()} records`}
          />
          <Table headers={["Date", "Patient", "Type", "Reason", "Status", "Actions"]}>
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-surface-200/60">
                <td className="px-5 py-3.5 text-foreground-light">{formatDate(row.followUpDate)}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={row.patientName || row.patientMrn} size="sm" />
                    <div>
                      <p className="text-sm text-foreground">{row.patientName || "—"}</p>
                      <p className="text-[11px] text-foreground-lighter">{row.patientMrn}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-foreground-light">{row.followUpType || "—"}</td>
                <td className="max-w-xs truncate px-5 py-3.5 text-foreground-light" title={row.reason}>
                  {row.reason}
                </td>
                <td className="px-5 py-3.5">
                  <Badge tone={STATUS_TONES[row.status] ?? "slate"}>
                    {row.status.replaceAll("_", " ")}
                  </Badge>
                </td>
                <td className="px-5 py-3.5">
                  <FollowUpRowActions
                    onQuickView={() => setQuickView(row)}
                    onDetailedView={() => openDetailed(row)}
                    canOpenLinkedConsultation={hasLinkedConsultation(row)}
                    onOpenLinkedConsultation={() => openLinkedConsultation(row)}
                    canComplete={row.status === "SCHEDULED"}
                    onMarkComplete={() => void markComplete(row.id)}
                  />
                </td>
              </tr>
            ))}
          </Table>
          {loading && (
            <div className="space-y-2 px-4 py-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-xl bg-surface-200" />
              ))}
            </div>
          )}
          {!loading && rows.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-foreground-lighter">
              No follow-ups match this filter.
            </p>
          )}
          <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous"
                className="rounded-lg border border-border p-2 text-foreground-light hover:bg-surface-200"
                onClick={() => {
                  if (calendarMode === "month") setCursor((c) => addMonths(c, -1));
                  else if (calendarMode === "week") setCursor((c) => addDays(c, -7));
                  else setCursor((c) => addDays(c, -1));
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next"
                className="rounded-lg border border-border p-2 text-foreground-light hover:bg-surface-200"
                onClick={() => {
                  if (calendarMode === "month") setCursor((c) => addMonths(c, 1));
                  else if (calendarMode === "week") setCursor((c) => addDays(c, 7));
                  else setCursor((c) => addDays(c, 1));
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="ml-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-200"
                onClick={() => {
                  const now = new Date();
                  setCursor(startOfMonth(now));
                  setSelectedDate(toYmd(now));
                  setPage(1);
                }}
              >
                Today
              </button>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {calendarMode === "month"
                ? formatMonthLabel(cursor)
                : calendarMode === "week"
                  ? `Week of ${toYmd(startOfWeek(cursor))}`
                  : selectedDate || toYmd(cursor)}
            </p>
            <div className="inline-flex rounded-lg border border-border bg-surface-200 p-0.5">
              {(["month", "week", "day"] as CalendarMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCalendarMode(mode)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize ${
                    calendarMode === mode
                      ? "bg-slate-900 text-white"
                      : "text-foreground-light hover:text-foreground"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {calendarLoading && (
            <p className="px-4 py-3 text-xs text-foreground-lighter">Loading calendar…</p>
          )}

          {calendarMode === "month" && (
            <div className="grid grid-cols-7 border-t border-border">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="border-b border-border px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-foreground-lighter"
                >
                  {d}
                </div>
              ))}
              {monthGrid(cursor).map((day) => {
                const ymd = toYmd(day);
                const inMonth = day.getMonth() === cursor.getMonth();
                const items = byDate.get(ymd) ?? [];
                const selected = selectedDate === ymd;
                const isToday = ymd === todayYmd;
                return (
                  <button
                    key={ymd}
                    type="button"
                    onClick={() => selectDay(ymd)}
                    className={`min-h-28 border-b border-r border-border p-2 text-left transition ${
                      selected
                        ? "bg-amber-50 ring-2 ring-inset ring-amber-300"
                        : isToday
                          ? "bg-[#fffbeb]"
                          : "bg-white hover:bg-surface-200/80"
                    } ${!inMonth ? "opacity-45" : ""}`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold ${
                          selected ? "text-amber-900" : "text-foreground"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                      {items.length > 0 && (
                        <span className="rounded-full bg-accent-100 px-1.5 text-[10px] font-medium text-accent-700">
                          {items.length}
                        </span>
                      )}
                    </div>
                    <ul className="space-y-0.5">
                      {items.slice(0, 3).map((a) => (
                        <li
                          key={a.id}
                          className="truncate text-[11px] font-medium text-accent-700"
                          title={`${a.patientName} · ${a.reason}`}
                        >
                          {a.patientName}
                        </li>
                      ))}
                      {items.length > 3 && (
                        <li className="text-[10px] font-semibold text-brand-700">
                          +{items.length - 3} more
                        </li>
                      )}
                    </ul>
                  </button>
                );
              })}
            </div>
          )}

          {(calendarMode === "week" || calendarMode === "day") && (
            <div className="divide-y divide-border">
              {(calendarMode === "week"
                ? Array.from({ length: 7 }, (_, i) => toYmd(addDays(startOfWeek(cursor), i)))
                : [selectedDate || toYmd(cursor)]
              ).map((ymd) => {
                const items = byDate.get(ymd) ?? [];
                return (
                  <div key={ymd} className="px-4 py-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-lighter">
                      {formatDate(ymd)}
                    </p>
                    {items.length === 0 ? (
                      <p className="text-sm text-foreground-lighter">No follow-ups</p>
                    ) : (
                      <ul className="space-y-2">
                        {items.map((row) => (
                          <li key={row.id}>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-left hover:bg-surface-200"
                              onClick={() => setQuickView(row)}
                            >
                              <span className="text-sm font-medium text-foreground">
                                {row.patientName}
                              </span>
                              <Badge tone={STATUS_TONES[row.status] ?? "slate"}>
                                {row.status.replaceAll("_", " ")}
                              </Badge>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Schedule follow-up</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-4 w-4 text-foreground-lighter" />
              </button>
            </div>
            <div>
              <FieldLabel required>Patient</FieldLabel>
              <PatientSearchSelect value={patientId} onChange={(id) => setPatientId(id)} />
            </div>
            <div>
              <FieldLabel required>Date</FieldLabel>
              <input
                className={inputClass}
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel optional>Type</FieldLabel>
              <input
                className={inputClass}
                value={followUpType}
                onChange={(e) => setFollowUpType(e.target.value)}
                placeholder="Review, procedure, labs…"
              />
            </div>
            <div>
              <FieldLabel required>Reason</FieldLabel>
              <textarea
                className={inputClass}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel optional>Notes</FieldLabel>
              <textarea
                className={inputClass}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            {formError && <p className="text-[11px] font-medium text-rose-500">{formError}</p>}
            <PrimaryButton disabled={busy} onClick={() => void schedule()}>
              {busy ? "Saving…" : "Schedule"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {quickView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Follow-up</h2>
              <button type="button" onClick={() => setQuickView(null)}>
                <X className="h-4 w-4 text-foreground-lighter" />
              </button>
            </div>
            <p className="text-sm font-medium text-foreground">{quickView.patientName}</p>
            <p className="text-xs text-foreground-lighter">{quickView.patientMrn}</p>
            <p className="text-sm text-foreground-light">
              {formatDate(quickView.followUpDate)} · {quickView.followUpType || "Follow-up"}
            </p>
            <p className="text-sm text-foreground">{quickView.reason}</p>
            {quickView.doctorName && (
              <p className="text-xs text-foreground-light">Doctor: {quickView.doctorName}</p>
            )}
            <Badge tone={STATUS_TONES[quickView.status] ?? "slate"}>
              {quickView.status.replaceAll("_", " ")}
            </Badge>
            <div className="flex flex-wrap gap-2 pt-2">
              {hasLinkedConsultation(quickView) ? (
                <PrimaryButton
                  onClick={() => openLinkedConsultation(quickView)}
                >
                  Open linked consultation
                </PrimaryButton>
              ) : (
                <p className="text-xs text-slate-400">
                  No linked consultation on file for this follow-up.
                </p>
              )}
              {quickView.patientId ? (
                <button
                  type="button"
                  onClick={() => router.push(`/patients/${quickView.patientId}`)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-brand-300"
                >
                  Open patient
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
