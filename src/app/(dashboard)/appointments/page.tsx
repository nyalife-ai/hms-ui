"use client";

import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutList,
  Plus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppointmentQuickViewModal } from "@/components/appointment-quick-view-modal";
import { AppointmentRowActions } from "@/components/appointment-row-actions";
import { DoctorSearchSelect } from "@/components/doctor-search-select";
import { FieldLabel } from "@/components/field-label";
import { PaginationBar } from "@/components/pagination-bar";
import { PatientSearchSelect } from "@/components/patient-search-select";
import { RoleGuard } from "@/components/role-guard";
import {
  Avatar,
  Badge,
  Card,
  PageHeader,
  PrimaryButton,
  StatCard,
  Table,
  type BadgeTone,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  useAppointmentSummary,
  usePaginatedCatalog,
  type CatalogAppointment,
} from "@/lib/catalog";
import { toPageMeta, unwrapPage } from "@/lib/pagination";
import { FRONT_DESK_ROLES, canAccess } from "@/lib/roles";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useVisits, type Visit } from "@/lib/visits";
import {
  relatedLabsHref,
  relatedPrescriptionsHref,
} from "@/lib/clinical-links";

const STATUS_TONES: Record<string, BadgeTone> = {
  Scheduled: "blue",
  "Checked In": "teal",
  Pending: "amber",
  Completed: "green",
  Cancelled: "red",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type ViewMode = "list" | "calendar";
type CalendarMode = "month" | "week" | "day";

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

function formatTime12(time: string): string {
  const [hh, mm] = time.split(":").map(Number);
  if (!Number.isFinite(hh)) return time;
  const suffix = hh >= 12 ? "pm" : "am";
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm ?? 0).padStart(2, "0")}${suffix}`;
}

function monthGrid(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export default function AppointmentsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canOperateDesk = Boolean(user && FRONT_DESK_ROLES.includes(user.role));

  const [view, setView] = useState<ViewMode>("list");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("month");
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const search = useDebouncedValue(searchInput, 400);

  const {
    data: summary,
    loading: summaryLoading,
    refresh: refreshSummary,
  } = useAppointmentSummary();

  const listParams = useMemo(
    () => ({
      page,
      limit: 50,
      search: search || undefined,
      status: statusFilter || undefined,
      from: selectedDate || undefined,
      to: selectedDate || undefined,
      doctorId:
        user?.role === "DOCTOR" ? user.staffProfileId || undefined : undefined,
    }),
    [page, search, statusFilter, selectedDate, user?.role, user?.staffProfileId],
  );

  const {
    items: appointments,
    total,
    limit,
    loading,
    error,
    refresh,
  } = usePaginatedCatalog<CatalogAppointment>("/catalog/appointments", listParams);

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

  const [calendarItems, setCalendarItems] = useState<CatalogAppointment[]>([]);
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
      if (user?.role === "DOCTOR" && user.staffProfileId) {
        qs.set("doctorId", user.staffProfileId);
      }
      const res = unwrapPage<CatalogAppointment>(
        await api(`/catalog/appointments?${qs.toString()}`),
      );
      setCalendarItems(res.items);
    } catch {
      setCalendarItems([]);
    } finally {
      setCalendarLoading(false);
    }
  }, [
    calendarRange.from,
    calendarRange.to,
    search,
    statusFilter,
    user?.role,
    user?.staffProfileId,
  ]);

  useEffect(() => {
    if (view === "calendar") void loadCalendar();
  }, [view, loadCalendar]);

  const byDate = useMemo(() => {
    const map = new Map<string, CatalogAppointment[]>();
    for (const a of calendarItems) {
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    }
    return map;
  }, [calendarItems]);

  const { checkIn } = useVisits();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionId, setActionId] = useState("");
  const [formError, setFormError] = useState("");
  const [patientId, setPatientId] = useState("");
  const [patientLabel, setPatientLabel] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(() => toYmd(new Date()));
  const [time, setTime] = useState("09:00");
  const [type, setType] = useState("CONSULTATION");
  const [reason, setReason] = useState("");
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newGender, setNewGender] = useState<"Male" | "Female" | "Other">("Female");
  const [newDateOfBirth, setNewDateOfBirth] = useState("");
  const [newAllergies, setNewAllergies] = useState("");
  const [newChronic, setNewChronic] = useState("");
  const [newKinName, setNewKinName] = useState("");
  const [newKinPhone, setNewKinPhone] = useState("");
  const [newPatientBusy, setNewPatientBusy] = useState(false);
  const [newPatientError, setNewPatientError] = useState("");

  const refreshAll = async () => {
    await Promise.all([refresh(), refreshSummary(), view === "calendar" ? loadCalendar() : Promise.resolve()]);
  };

  const openJourney = async (appointment: CatalogAppointment) => {
    try {
      const rows = await api<Visit[]>(`/visits?appointmentId=${appointment.id}`);
      const visit = rows[0];
      router.push(visit ? `/consultations/${visit.id}` : `/appointments/${appointment.id}`);
    } catch {
      router.push(`/appointments/${appointment.id}`);
    }
  };

  const relatedFor = (appointment: CatalogAppointment) => ({
    appointmentId: appointment.id,
    patientName: appointment.patient,
  });

  const submit = async () => {
    if (!patientId || !doctorId) {
      setFormError("Select patient and doctor.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api("/ops/appointments", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          doctorId,
          date,
          time,
          type,
          reason: reason.trim() || undefined,
        }),
      });
      setOpen(false);
      setPatientId("");
      setPatientLabel("");
      setDoctorId("");
      setReason("");
      await refreshAll();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Unable to book the appointment. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const createPatientForBooking = async () => {
    if (!newFirstName.trim() || !newLastName.trim() || !newPhone.trim()) {
      setNewPatientError("First name, last name and phone are required.");
      return;
    }
    setNewPatientBusy(true);
    setNewPatientError("");
    try {
      const created = await api<{
        id: string;
        patient_number?: string;
        patientNumber?: string;
      }>("/ops/patients", {
        method: "POST",
        body: JSON.stringify({
          firstName: newFirstName.trim(),
          lastName: newLastName.trim(),
          gender: newGender,
          phone: newPhone.trim(),
          dateOfBirth: newDateOfBirth || undefined,
          allergies: newAllergies.trim() || undefined,
          chronicDiseases: newChronic.trim() || undefined,
          emergencyContactName: newKinName.trim() || undefined,
          emergencyContactPhone: newKinPhone.trim() || undefined,
        }),
      });
      const mrn = created.patient_number || created.patientNumber || "";
      const label = `${newFirstName.trim()} ${newLastName.trim()}${mrn ? ` · ${mrn}` : ""}`;
      setPatientId(created.id);
      setPatientLabel(label);
      setAddPatientOpen(false);
      setNewFirstName("");
      setNewLastName("");
      setNewPhone("");
      setNewGender("Female");
      setNewDateOfBirth("");
      setNewAllergies("");
      setNewChronic("");
      setNewKinName("");
      setNewKinPhone("");
      setFormError("");
    } catch (err) {
      setNewPatientError(
        err instanceof Error ? err.message : "Unable to register the patient",
      );
    } finally {
      setNewPatientBusy(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    setActionId(id);
    try {
      await api(`/appointments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refreshAll();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to update appointment",
      );
    } finally {
      setActionId("");
    }
  };

  const checkInFromSchedule = async (a: CatalogAppointment) => {
    if (!a.mrn) return;
    setActionId(a.id);
    try {
      await checkIn({
        patientName: a.patient,
        mrn: a.mrn,
        age: a.age ?? 0,
        gender: a.gender === "Male" ? "Male" : "Female",
        phone: a.phone ?? "",
        firstVisit: false,
        payment: { method: "CASH" },
        appointmentId: a.id,
      });
      await setStatus(a.id, "ARRIVED");
      if (user && canAccess(user.role, "front-desk", user.permissions)) {
        router.push("/front-desk");
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to check in");
    } finally {
      setActionId("");
    }
  };

  const selectDay = (ymd: string) => {
    setSelectedDate((prev) => (prev === ymd ? null : ymd));
    setPage(1);
    if (calendarMode === "day") {
      setCursor(new Date(`${ymd}T12:00:00`));
    }
  };

  const meta = toPageMeta({ total, page, limit });
  const todayYmd = toYmd(new Date());

  const kpi = summary ?? {
    total: 0,
    pending: 0,
    scheduled: 0,
    completed: 0,
  };

  return (
    <RoleGuard module="appointments">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Home / Appointments / {view === "list" ? "Appointments Ledger" : "Calendar View"}
      </div>
      <PageHeader
        title="Schedules & Appointments"
        subtitle={
          selectedDate
            ? `Filtered to ${selectedDate} · click the day again to clear`
            : view === "list"
              ? "Appointments ledger — book, check in, and track the day’s schedule"
              : "Calendar view — pick a day to highlight and filter"
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setView("list")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  view === "list"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900"
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
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" /> Calendar view
              </button>
            </div>
            {canOperateDesk ? (
              <PrimaryButton onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> Book appointment
              </PrimaryButton>
            ) : null}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Appointments"
          value={summaryLoading ? "…" : String(kpi.total)}
          deltaLabel="all booked visits"
          icon={ClipboardList}
        />
        <StatCard
          label="Pending"
          value={summaryLoading ? "…" : String(kpi.pending)}
          deltaLabel="checked in · waiting"
          icon={CalendarClock}
        />
        <StatCard
          label="Scheduled"
          value={summaryLoading ? "…" : String(kpi.scheduled)}
          deltaLabel="upcoming on the books"
          icon={CalendarCheck2}
        />
        <StatCard
          label="Completed"
          value={summaryLoading ? "…" : String(kpi.completed)}
          deltaLabel="finished visits"
          icon={CheckCircle2}
        />
      </div>

      {formError && <p className="mb-3 text-sm text-rose-500">{formError}</p>}

      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto]">
        <input
          className={inputClass}
          placeholder="Search patient, doctor, phone, MRN…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={inputClass}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="Scheduled">Scheduled</option>
          <option value="Pending">Pending (checked in)</option>
          <option value="Checked In">Checked in</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        {selectedDate ? (
          <button
            type="button"
            onClick={() => {
              setSelectedDate(null);
              setPage(1);
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
          >
            <X className="h-3.5 w-3.5" /> Clear {selectedDate}
          </button>
        ) : (
          <div className="hidden md:block" />
        )}
      </div>

      {view === "list" ? (
        <Card>
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Appointments Ledger</h2>
            <p className="text-xs text-slate-400">
              {loading
                ? "Loading…"
                : `${total.toLocaleString()} record${total === 1 ? "" : "s"}${
                    selectedDate ? ` on ${selectedDate}` : ""
                  }`}
            </p>
          </div>
          {error && <p className="px-4 py-3 text-sm text-rose-500">{error}</p>}
          <Table headers={["Patient", "Doctor", "Date", "Time", "Type", "Status", "Actions"]}>
            {!loading &&
              appointments.map((a) => {
                const isSelectedDay = selectedDate === a.date;
                return (
                  <tr
                    key={a.id}
                    className={`hover:bg-slate-50/60 ${
                      isSelectedDay ? "bg-amber-50/70" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={a.patient} size="sm" />
                        <div>
                          <p className="font-medium text-slate-800">{a.patient}</p>
                          <p className="text-[11px] text-slate-400">{a.mrn}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{a.doctor}</td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        className={`text-left text-sm ${
                          isSelectedDay
                            ? "font-semibold text-amber-800"
                            : "text-slate-500 hover:text-brand-700"
                        }`}
                        onClick={() => selectDay(a.date)}
                        title="Filter by this day"
                      >
                        {a.date}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{a.time}</td>
                    <td className="px-4 py-2.5 text-slate-500">{a.type}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={STATUS_TONES[a.status] ?? "slate"}>{a.status}</Badge>
                    </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    {canOperateDesk && a.status === "Scheduled" && (
                      <>
                        <button
                          type="button"
                          disabled={actionId === a.id}
                          className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-700 hover:border-brand-300 disabled:opacity-40"
                          onClick={() => void checkInFromSchedule(a)}
                        >
                          Check in
                        </button>
                        <button
                          type="button"
                          disabled={actionId === a.id}
                          className="rounded-full border border-rose-100 px-2 py-1 text-[10px] font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                          onClick={() => void setStatus(a.id, "CANCELLED")}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    <AppointmentRowActions
                      onQuickView={() => setQuickViewId(a.id)}
                      onDetailedView={() => void openJourney(a)}
                      onRelatedLabs={() => router.push(relatedLabsHref(relatedFor(a)))}
                      onRelatedPrescriptions={() =>
                        router.push(relatedPrescriptionsHref(relatedFor(a)))
                      }
                    />
                  </div>
                </td>
                  </tr>
                );
              })}
          </Table>
          {loading && (
            <div className="space-y-2 px-4 py-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          )}
          {!loading && appointments.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              No appointments match this filter.
            </p>
          )}
          <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous"
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
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
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
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
                className="ml-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
            <p className="text-sm font-semibold text-slate-800">
              {calendarMode === "month"
                ? formatMonthLabel(cursor)
                : calendarMode === "week"
                  ? `Week of ${toYmd(startOfWeek(cursor))}`
                  : selectedDate || toYmd(cursor)}
            </p>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {(["month", "week", "day"] as CalendarMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCalendarMode(mode)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${
                    calendarMode === mode
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {calendarLoading && (
            <p className="px-4 py-3 text-xs text-slate-400">Loading calendar…</p>
          )}

          {calendarMode === "month" && (
            <div className="grid grid-cols-7 border-t border-slate-100">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="border-b border-slate-100 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400"
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
                    className={`min-h-28 border-b border-r border-slate-100 p-2 text-left transition ${
                      selected
                        ? "bg-amber-50 ring-2 ring-inset ring-amber-300"
                        : isToday
                          ? "bg-[#fffbeb]"
                          : "bg-white hover:bg-slate-50/80"
                    } ${!inMonth ? "opacity-45" : ""}`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold ${
                          selected ? "text-amber-900" : "text-slate-700"
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
                          title={`${a.time} ${a.patient} · ${a.doctor}`}
                        >
                          {formatTime12(a.time)} {a.patient}
                        </li>
                      ))}
                      {items.length > 3 && (
                        <li>
                          <button
                            type="button"
                            className="text-[10px] font-semibold text-brand-700 hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(ymd);
                              setCalendarMode("day");
                              setCursor(new Date(`${ymd}T12:00:00`));
                              setPage(1);
                            }}
                          >
                            +{items.length - 3} more
                          </button>
                        </li>
                      )}
                    </ul>
                  </button>
                );
              })}
            </div>
          )}

          {calendarMode === "week" && (
            <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-7">
              {Array.from({ length: 7 }, (_, i) => {
                const day = addDays(startOfWeek(cursor), i);
                const ymd = toYmd(day);
                const items = byDate.get(ymd) ?? [];
                const selected = selectedDate === ymd;
                return (
                  <button
                    key={ymd}
                    type="button"
                    onClick={() => selectDay(ymd)}
                    className={`rounded-xl border p-3 text-left ${
                      selected
                        ? "border-amber-300 bg-amber-50"
                        : "border-slate-200 bg-white hover:border-brand-200"
                    }`}
                  >
                    <p className="text-[11px] font-semibold uppercase text-slate-400">
                      {WEEKDAYS[day.getDay()]}
                    </p>
                    <p className="text-sm font-bold text-slate-800">{day.getDate()}</p>
                    <ul className="mt-2 space-y-1">
                      {items.map((a) => (
                        <li key={a.id} className="text-[11px] text-accent-700">
                          {formatTime12(a.time)} {a.patient}
                        </li>
                      ))}
                      {items.length === 0 && (
                        <li className="text-[11px] text-slate-300">No appointments</li>
                      )}
                    </ul>
                  </button>
                );
              })}
            </div>
          )}

          {calendarMode === "day" && (
            <div className="p-4">
              <div
                className={`mb-3 rounded-xl border px-4 py-3 ${
                  selectedDate
                    ? "border-amber-300 bg-amber-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <p className="text-sm font-semibold text-slate-800">
                  {selectedDate || toYmd(cursor)}
                </p>
                <p className="text-xs text-slate-500">
                  {(byDate.get(selectedDate || toYmd(cursor)) ?? []).length} appointment(s)
                </p>
              </div>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {(byDate.get(selectedDate || toYmd(cursor)) ?? []).map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {formatTime12(a.time)} · {a.patient}
                      </p>
                      <p className="text-xs text-slate-400">
                        {a.doctor} · {a.type}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={STATUS_TONES[a.status] ?? "slate"}>{a.status}</Badge>
                      {canOperateDesk && a.status === "Scheduled" && (
                        <>
                          <button
                            type="button"
                            disabled={actionId === a.id}
                            className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-700"
                            onClick={() => void checkInFromSchedule(a)}
                          >
                            Check in
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-rose-100 px-2 py-1 text-[10px] font-medium text-rose-600"
                            onClick={() => void setStatus(a.id, "CANCELLED")}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      <AppointmentRowActions
                        onQuickView={() => setQuickViewId(a.id)}
                        onDetailedView={() => void openJourney(a)}
                        onRelatedLabs={() => router.push(relatedLabsHref(relatedFor(a)))}
                        onRelatedPrescriptions={() =>
                          router.push(relatedPrescriptionsHref(relatedFor(a)))
                        }
                      />
                    </div>
                  </li>
                ))}
                {(byDate.get(selectedDate || toYmd(cursor)) ?? []).length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-slate-400">
                    No appointments on this day.
                  </li>
                )}
              </ul>
            </div>
          )}

          {selectedDate && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <p className="text-xs text-amber-800">
                Day filter active: <span className="font-semibold">{selectedDate}</span> — switch to
                List view to work the ledger for that day.
              </p>
              <button
                type="button"
                className="text-xs font-semibold text-brand-700 hover:underline"
                onClick={() => setView("list")}
              >
                Open ledger
              </button>
            </div>
          )}
        </Card>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex justify-between">
              <h2 className="font-semibold">Book appointment</h2>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setAddPatientOpen(false);
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <FieldLabel required>Patient</FieldLabel>
                <button
                  type="button"
                  onClick={() => {
                    setAddPatientOpen((v) => !v);
                    setNewPatientError("");
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {addPatientOpen ? "Cancel new patient" : "Add new patient"}
                </button>
              </div>
              {addPatientOpen ? (
                <div className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-3">
                  <p className="text-[11px] text-slate-500">
                    Register the patient, then they will be selected for this appointment.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <FieldLabel required>First name</FieldLabel>
                      <input
                        className={inputClass}
                        value={newFirstName}
                        onChange={(e) => setNewFirstName(e.target.value)}
                      />
                    </div>
                    <div>
                      <FieldLabel required>Last name</FieldLabel>
                      <input
                        className={inputClass}
                        value={newLastName}
                        onChange={(e) => setNewLastName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <FieldLabel required>Gender</FieldLabel>
                    <select
                      className={inputClass}
                      value={newGender}
                      onChange={(e) =>
                        setNewGender(e.target.value as "Male" | "Female" | "Other")
                      }
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <FieldLabel required>Phone</FieldLabel>
                    <input
                      className={inputClass}
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel optional>Date of birth</FieldLabel>
                    <input
                      className={inputClass}
                      type="date"
                      value={newDateOfBirth}
                      onChange={(e) => setNewDateOfBirth(e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel optional>Allergies</FieldLabel>
                    <input
                      className={inputClass}
                      value={newAllergies}
                      onChange={(e) => setNewAllergies(e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel optional>Chronic conditions</FieldLabel>
                    <input
                      className={inputClass}
                      value={newChronic}
                      onChange={(e) => setNewChronic(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <FieldLabel optional>Next of kin</FieldLabel>
                      <input
                        className={inputClass}
                        value={newKinName}
                        onChange={(e) => setNewKinName(e.target.value)}
                      />
                    </div>
                    <div>
                      <FieldLabel optional>Kin phone</FieldLabel>
                      <input
                        className={inputClass}
                        value={newKinPhone}
                        onChange={(e) => setNewKinPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  {newPatientError && (
                    <p className="text-xs text-rose-500">{newPatientError}</p>
                  )}
                  <PrimaryButton
                    disabled={newPatientBusy}
                    onClick={() => void createPatientForBooking()}
                  >
                    {newPatientBusy ? "Saving…" : "Save & select patient"}
                  </PrimaryButton>
                </div>
              ) : (
                <PatientSearchSelect
                  value={patientId}
                  displayLabel={patientLabel}
                  onChange={(id, patient) => {
                    setPatientId(id);
                    setPatientLabel(
                      patient ? `${patient.name} · ${patient.mrn}` : "",
                    );
                  }}
                />
              )}
            </div>
            <div>
              <FieldLabel required>Doctor</FieldLabel>
              <DoctorSearchSelect value={doctorId} onChange={(id) => setDoctorId(id)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <FieldLabel required>Date</FieldLabel>
                <input
                  className={inputClass}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <FieldLabel required>Time</FieldLabel>
                <input
                  className={inputClass}
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>
            <div>
              <FieldLabel required>Type</FieldLabel>
              <select
                className={inputClass}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="CONSULTATION">Consultation</option>
                <option value="FOLLOW_UP">Follow-up</option>
                <option value="NEW_PATIENT">New patient</option>
                <option value="EMERGENCY">Emergency</option>
              </select>
            </div>
            <div>
              <FieldLabel>Reason for visit</FieldLabel>
              <textarea
                className={`${inputClass} min-h-20 resize-y`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is the patient coming in?"
              />
            </div>
            {formError && <p className="text-sm text-rose-500">{formError}</p>}
            <PrimaryButton disabled={busy || addPatientOpen} onClick={submit}>
              {busy ? "Saving…" : "Book"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {quickViewId && (
        <AppointmentQuickViewModal
          appointmentId={quickViewId}
          onClose={() => setQuickViewId(null)}
        />
      )}
    </RoleGuard>
  );
}
