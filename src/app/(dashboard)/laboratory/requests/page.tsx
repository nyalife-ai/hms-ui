"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DoctorSearchSelect } from "@/components/doctor-search-select";
import { FieldLabel } from "@/components/field-label";
import { PaginationBar } from "@/components/pagination-bar";
import { PatientSearchSelect } from "@/components/patient-search-select";
import { RoleGuard } from "@/components/role-guard";
import {
  Badge,
  Card,
  CardHeader,
  PageHeader,
  PrimaryButton,
  Table,
  type BadgeTone,
} from "@/components/ui";
import { api } from "@/lib/api";
import { buildListQuery, toPageMeta, unwrapPage } from "@/lib/pagination";
import { statusLabel } from "@/lib/lab-types";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "amber",
  IN_PROGRESS: "teal",
  COMPLETED: "green",
  CANCELLED: "slate",
};

const PRIORITY_TONE: Record<string, BadgeTone> = {
  NORMAL: "slate",
  URGENT: "amber",
  STAT: "red",
};

type RequestRow = {
  id: string;
  requestNumber: string | null;
  patientName: string;
  mrn: string | null;
  requestingDoctor: string | null;
  priority: string;
  status: string;
  requestDate: string;
};

type TestType = { id: string; testName: string };

type ViewMode = "list" | "calendar";
type CalendarMode = "month" | "week" | "day";

const PAGE_SIZE = 50;

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

export default function LabRequestsPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [types, setTypes] = useState<TestType[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const [view, setView] = useState<ViewMode>("list");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("month");
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toYmd(new Date()));
  const [calendarItems, setCalendarItems] = useState<RequestRow[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [testTypeId, setTestTypeId] = useState("");
  const [reqPriority, setReqPriority] = useState("NORMAL");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search).get("search");
    if (q) setSearchInput(q);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildListQuery({
        status: status || undefined,
        priority: priority || undefined,
        search: search || undefined,
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      });
      const [r, t] = await Promise.all([
        api(`/laboratory/requests?${qs}`),
        api("/laboratory/test-types?active=true&take=100"),
      ]);
      const reqPage = unwrapPage<RequestRow>(r);
      setRows(reqPage.items);
      setTotal(reqPage.total);
      setTypes(unwrapPage<TestType>(t).items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [status, priority, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const calendarRange = useMemo(() => {
    if (calendarMode === "month") {
      const from = startOfWeek(startOfMonth(cursor));
      return { from: toYmd(from), to: toYmd(addDays(from, 41)) };
    }
    if (calendarMode === "week") {
      const from = startOfWeek(cursor);
      return { from: toYmd(from), to: toYmd(addDays(from, 6)) };
    }
    return { from: selectedDate, to: selectedDate };
  }, [calendarMode, cursor, selectedDate]);

  const loadCalendar = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const qs = buildListQuery({
        status: status || undefined,
        priority: priority || undefined,
        search: search || undefined,
        from: `${calendarRange.from}T00:00:00.000Z`,
        to: `${calendarRange.to}T23:59:59.999Z`,
        take: 100,
        skip: 0,
      });
      const r = await api(`/laboratory/requests?${qs}`);
      setCalendarItems(unwrapPage<RequestRow>(r).items);
    } catch {
      setCalendarItems([]);
    } finally {
      setCalendarLoading(false);
    }
  }, [calendarRange.from, calendarRange.to, search, status, priority]);

  useEffect(() => {
    if (view === "calendar") void loadCalendar();
  }, [view, loadCalendar]);

  const byDate = useMemo(() => {
    const map = new Map<string, RequestRow[]>();
    for (const r of calendarItems) {
      const key = r.requestDate.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return map;
  }, [calendarItems]);

  const create = async () => {
    if (!patientId || !testTypeId) return;
    setBusy(true);
    try {
      await api("/laboratory/requests", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          requestingDoctorId: doctorId || undefined,
          testTypeIds: [testTypeId],
          priority: reqPriority,
        }),
      });
      setOpen(false);
      setPatientId("");
      setDoctorId("");
      setTestTypeId("");
      await load();
      if (view === "calendar") await loadCalendar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    try {
      await api(`/laboratory/requests/${id}/cancel`, { method: "POST" });
      await load();
      if (view === "calendar") await loadCalendar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    }
  };

  const meta = toPageMeta({ total, page, limit: PAGE_SIZE });
  const weekDays = Array.from({ length: 7 }, (_, i) =>
    addDays(startOfWeek(new Date(selectedDate + "T12:00:00")), i),
  );

  return (
    <RoleGuard module="laboratory">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Home / Laboratory / Requests
      </div>
      <PageHeader
        title="Lab Requests"
        subtitle={
          loading
            ? "Loading…"
            : view === "list"
              ? `${total.toLocaleString()} requests · order → sample → results → verify`
              : "Calendar view — scheduled / request dates"
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-slate-200 p-0.5">
              <button
                type="button"
                onClick={() => setView("list")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  view === "list"
                    ? "bg-brand-500 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <List className="h-3.5 w-3.5" /> List
              </button>
              <button
                type="button"
                onClick={() => setView("calendar")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  view === "calendar"
                    ? "bg-brand-500 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" /> Calendar
              </button>
            </div>
            <PrimaryButton onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New request
            </PrimaryButton>
          </div>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3">
        <input
          className={inputClass}
          placeholder="Search request # / MRN"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={inputClass}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <select
          className={inputClass}
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All priorities</option>
          {["NORMAL", "URGENT", "STAT"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {view === "list" && (
        <Card>
          <CardHeader title="Requests" subtitle={`${total.toLocaleString()} total`} />
          <Table headers={["Request", "Patient", "Doctor", "Priority", "Status", "Date", ""]}>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="px-5 py-3.5 font-medium text-slate-800">{r.requestNumber}</td>
                <td className="px-5 py-3.5 text-slate-500">
                  {r.patientName}
                  <span className="block text-xs text-slate-400">{r.mrn}</span>
                </td>
                <td className="px-5 py-3.5 text-slate-500">{r.requestingDoctor || "—"}</td>
                <td className="px-5 py-3.5">
                  <Badge tone={PRIORITY_TONE[r.priority] ?? "slate"}>{r.priority}</Badge>
                </td>
                <td className="px-5 py-3.5">
                  <Badge tone={STATUS_TONE[r.status] ?? "slate"}>
                    {statusLabel(r.status)}
                  </Badge>
                </td>
                <td className="px-5 py-3.5 text-slate-500 text-xs">
                  {r.requestDate.slice(0, 10)}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex gap-2">
                    <Link
                      href={`/laboratory/requests/${r.id}`}
                      className="rounded-full border px-3 py-1 text-xs font-medium text-slate-700 hover:border-brand-300"
                    >
                      Open
                    </Link>
                    {(r.status === "PENDING" || r.status === "IN_PROGRESS") && (
                      <button
                        type="button"
                        className="rounded-full border px-3 py-1 text-xs text-rose-600"
                        onClick={() => void cancel(r.id)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
        </Card>
      )}

      {view === "calendar" && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                onClick={() => {
                  if (calendarMode === "month") setCursor((c) => addMonths(c, -1));
                  else if (calendarMode === "week") setCursor((c) => addDays(c, -7));
                  else setSelectedDate(toYmd(addDays(new Date(selectedDate + "T12:00:00"), -1)));
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                onClick={() => {
                  if (calendarMode === "month") setCursor((c) => addMonths(c, 1));
                  else if (calendarMode === "week") setCursor((c) => addDays(c, 7));
                  else setSelectedDate(toYmd(addDays(new Date(selectedDate + "T12:00:00"), 1)));
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <p className="text-sm font-semibold text-slate-800">
                {calendarMode === "month"
                  ? formatMonthLabel(cursor)
                  : calendarMode === "week"
                    ? `Week of ${toYmd(startOfWeek(cursor))}`
                    : selectedDate}
              </p>
            </div>
            <div className="inline-flex rounded-full border border-slate-200 p-0.5">
              {(["month", "week", "day"] as CalendarMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCalendarMode(mode)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                    calendarMode === mode
                      ? "bg-brand-500 text-white"
                      : "text-slate-600 hover:bg-slate-50"
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
            <div className="grid grid-cols-7 gap-px bg-slate-100 p-px">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  className="bg-slate-50 px-2 py-2 text-center text-[10px] font-semibold uppercase text-slate-400"
                >
                  {d}
                </div>
              ))}
              {monthGrid(cursor).map((day) => {
                const key = toYmd(day);
                const items = byDate.get(key) ?? [];
                const inMonth = day.getMonth() === cursor.getMonth();
                const isSelected = key === selectedDate;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedDate(key);
                      if (items.length > 3) setCalendarMode("day");
                    }}
                    className={`min-h-[88px] bg-white p-1.5 text-left ${
                      inMonth ? "" : "opacity-40"
                    } ${isSelected ? "ring-2 ring-inset ring-brand-400" : ""}`}
                  >
                    <span className="text-xs font-semibold text-slate-700">
                      {day.getDate()}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {items.slice(0, 3).map((r) => (
                        <Link
                          key={r.id}
                          href={`/laboratory/requests/${r.id}`}
                          className="block truncate rounded bg-brand-50 px-1 py-0.5 text-[10px] font-medium text-brand-800 hover:bg-brand-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.requestNumber}
                        </Link>
                      ))}
                      {items.length > 3 && (
                        <span className="text-[10px] text-slate-400">
                          +{items.length - 3} more
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {calendarMode === "week" && (
            <div className="grid grid-cols-1 gap-2 p-4 md:grid-cols-7">
              {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i)).map(
                (day) => {
                  const key = toYmd(day);
                  const items = byDate.get(key) ?? [];
                  return (
                    <div key={key} className="rounded-xl border border-slate-100 p-2">
                      <p className="text-xs font-semibold text-slate-700">
                        {day.toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <div className="mt-2 space-y-1">
                        {items.map((r) => (
                          <Link
                            key={r.id}
                            href={`/laboratory/requests/${r.id}`}
                            className="block rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] hover:bg-brand-50"
                          >
                            <span className="font-semibold text-slate-800">
                              {r.requestNumber}
                            </span>
                            <span className="block text-slate-400">{r.patientName}</span>
                          </Link>
                        ))}
                        {!items.length && (
                          <p className="text-[11px] text-slate-300">No requests</p>
                        )}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}

          {calendarMode === "day" && (
            <div className="p-4">
              <p className="mb-3 text-sm font-semibold text-slate-800">
                {new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              <div className="mb-3 flex flex-wrap gap-1">
                {weekDays.map((d) => {
                  const key = toYmd(d);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDate(key)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        key === selectedDate
                          ? "bg-brand-500 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
              <ul className="space-y-2">
                {(byDate.get(selectedDate) ?? []).map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/laboratory/requests/${r.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2.5 hover:border-brand-200"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {r.requestNumber}
                        </p>
                        <p className="text-xs text-slate-400">
                          {r.patientName} · {r.mrn}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <Badge tone={PRIORITY_TONE[r.priority] ?? "slate"}>
                          {r.priority}
                        </Badge>
                        <Badge tone={STATUS_TONE[r.status] ?? "slate"}>
                          {statusLabel(r.status)}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                ))}
                {(byDate.get(selectedDate) ?? []).length === 0 && (
                  <p className="text-sm text-slate-400">No lab requests on this day.</p>
                )}
              </ul>
            </div>
          )}
        </Card>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex justify-between">
              <h2 className="font-semibold">New lab request</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <FieldLabel required>Patient</FieldLabel>
              <PatientSearchSelect value={patientId} onChange={(id) => setPatientId(id)} />
            </div>
            <div>
              <FieldLabel optional>Requesting doctor</FieldLabel>
              <DoctorSearchSelect value={doctorId} onChange={(id) => setDoctorId(id)} />
            </div>
            <div>
              <FieldLabel required>Test type</FieldLabel>
              <select
                className={inputClass}
                value={testTypeId}
                onChange={(e) => setTestTypeId(e.target.value)}
              >
                <option value="">Select test</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.testName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel required>Priority</FieldLabel>
              <select
                className={inputClass}
                value={reqPriority}
                onChange={(e) => setReqPriority(e.target.value)}
              >
                {["NORMAL", "URGENT", "STAT"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <PrimaryButton disabled={busy} onClick={create}>
              {busy ? "Saving…" : "Create"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
