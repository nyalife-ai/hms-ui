"use client";

import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  useDoctors,
  useDashboardSummary,
  type CatalogAppointment,
} from "@/lib/catalog";
import { unwrapPage } from "@/lib/pagination";
import { canAccess } from "@/lib/roles";
import { Avatar, Badge, Card, CardHeader } from "./ui";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type FollowUpLite = {
  id: string;
  patientName: string;
  followUpDate: string;
  followUpType?: string;
  status?: string;
  doctorName?: string;
};

function buildMonthGrid(year: number, monthIndex: number): (number | null)[] {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startPad = first.getDay();
  const cells: (number | null)[] = Array.from({ length: startPad }, () => null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthRange(year: number, monthIndex: number) {
  const from = new Date(year, monthIndex, 1);
  const to = new Date(year, monthIndex + 1, 0);
  return { from: ymd(from), to: ymd(to) };
}

export function MiniCalendar() {
  const { user } = useAuth();
  const now = new Date();
  const [cursor, setCursor] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const [selectedDay, setSelectedDay] = useState<number | null>(
    () => now.getDate(),
  );
  const [appointments, setAppointments] = useState<CatalogAppointment[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpLite[]>([]);
  const [loading, setLoading] = useState(true);

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const isCurrentMonth =
    year === now.getFullYear() && monthIndex === now.getMonth();
  const today = now.getDate();
  const grid = buildMonthGrid(year, monthIndex);
  const canFollowUps =
    !!user && canAccess(user.role, "follow-ups", user.permissions);
  const canAppointments =
    !!user && canAccess(user.role, "appointments", user.permissions);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    const { from, to } = monthRange(year, monthIndex);
    try {
      const tasks: Promise<void>[] = [];
      if (canAppointments) {
        tasks.push(
          api(`/catalog/appointments?from=${from}&to=${to}&limit=500`)
            .then((raw) => {
              setAppointments(unwrapPage<CatalogAppointment>(raw).items);
            })
            .catch(() => setAppointments([])),
        );
      } else {
        setAppointments([]);
      }
      if (canFollowUps) {
        tasks.push(
          api(`/follow-ups?from=${from}&to=${to}&limit=200`)
            .then((raw) => {
              setFollowUps(unwrapPage<FollowUpLite>(raw).items);
            })
            .catch(() => setFollowUps([])),
        );
      } else {
        setFollowUps([]);
      }
      await Promise.all(tasks);
    } finally {
      setLoading(false);
    }
  }, [year, monthIndex, canAppointments, canFollowUps]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    if (isCurrentMonth) setSelectedDay(today);
    else setSelectedDay(1);
  }, [year, monthIndex, isCurrentMonth, today]);

  const apptDays = useMemo(() => {
    const set = new Set<number>();
    for (const a of appointments) {
      if (a.date.startsWith(`${year}-${String(monthIndex + 1).padStart(2, "0")}`)) {
        set.add(Number(a.date.slice(8, 10)));
      }
    }
    return set;
  }, [appointments, year, monthIndex]);

  const followDays = useMemo(() => {
    const set = new Set<number>();
    for (const f of followUps) {
      const date = f.followUpDate?.slice(0, 10) ?? "";
      if (date.startsWith(`${year}-${String(monthIndex + 1).padStart(2, "0")}`)) {
        set.add(Number(date.slice(8, 10)));
      }
    }
    return set;
  }, [followUps, year, monthIndex]);

  const selectedIso =
    selectedDay == null
      ? null
      : `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;

  const dayAppointments = useMemo(() => {
    if (!selectedIso) return [];
    return appointments
      .filter((a) => a.date === selectedIso)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, selectedIso]);

  const dayFollowUps = useMemo(() => {
    if (!selectedIso) return [];
    return followUps.filter((f) => f.followUpDate?.slice(0, 10) === selectedIso);
  }, [followUps, selectedIso]);

  const title = cursor.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const selectedLabel = selectedIso
    ? new Date(`${selectedIso}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <div className="flex gap-1">
          <button
            className="rounded-lg p-1 text-foreground-lighter hover:bg-surface-200"
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(year, monthIndex - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            className="rounded-lg p-1 text-foreground-lighter hover:bg-surface-200"
            type="button"
            aria-label="Next month"
            onClick={() => setCursor(new Date(year, monthIndex + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-1.5 text-center text-xs">
        {WEEKDAYS.map((d) => (
          <span key={d} className="pb-1 font-medium text-foreground-muted">
            {d}
          </span>
        ))}
        {grid.map((day, i) => {
          if (day === null) {
            return (
              <span key={i} className="flex justify-center">
                <span className="h-8 w-8" />
              </span>
            );
          }
          const hasAppt = apptDays.has(day);
          const hasFollow = followDays.has(day);
          const hasEvent = hasAppt || hasFollow;
          const isToday = isCurrentMonth && day === today;
          const isSelected = selectedDay === day;
          return (
            <span key={i} className="flex justify-center">
              <button
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`relative flex h-8 w-8 flex-col items-center justify-center rounded-full text-[12px] transition ${
                  isSelected
                    ? "bg-brand-500 font-semibold text-white shadow-sm"
                    : isToday
                      ? "ring-1 ring-brand-400 font-semibold text-brand-700"
                      : hasEvent
                        ? "bg-brand-100 font-medium text-brand-700 hover:bg-brand-50"
                        : "text-foreground-light hover:bg-surface-200"
                }`}
                aria-label={`${title} ${day}${hasEvent ? ", has scheduled activity" : ""}`}
                aria-pressed={isSelected}
              >
                {day}
                {hasEvent && !isSelected ? (
                  <span className="absolute bottom-1 flex gap-0.5">
                    {hasAppt ? (
                      <span className="h-1 w-1 rounded-full bg-brand-500" />
                    ) : null}
                    {hasFollow ? (
                      <span className="h-1 w-1 rounded-full bg-amber-500" />
                    ) : null}
                  </span>
                ) : null}
              </button>
            </span>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-foreground-muted">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Appointment
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Follow-up
        </span>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-xs font-semibold text-foreground">{selectedLabel}</p>
        {loading ? (
          <p className="mt-2 text-[11px] text-foreground-lighter">Loading schedule…</p>
        ) : dayAppointments.length === 0 && dayFollowUps.length === 0 ? (
          <p className="mt-2 text-[11px] text-foreground-lighter">
            No appointments or follow-ups on this day.
          </p>
        ) : (
          <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
            {dayAppointments.map((item) => (
              <Link
                key={item.id}
                href="/appointments"
                className="block rounded-lg bg-brand-50/80 px-3 py-2 transition hover:bg-brand-50"
              >
                <p className="text-[11px] font-semibold text-foreground">
                  {item.time} — {item.patient}
                </p>
                <p className="truncate text-[10px] text-foreground-lighter">
                  {item.type} · {item.doctor}
                </p>
              </Link>
            ))}
            {dayFollowUps.map((item) => (
              <Link
                key={item.id}
                href="/follow-ups"
                className="block rounded-lg bg-amber-50/80 px-3 py-2 transition hover:bg-amber-50"
              >
                <p className="text-[11px] font-semibold text-foreground">
                  Follow-up — {item.patientName}
                </p>
                <p className="truncate text-[10px] text-foreground-lighter">
                  {item.followUpType || "Review"}
                  {item.doctorName ? ` · ${item.doctorName}` : ""}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export function AgendaCard() {
  const { user } = useAuth();
  const [items, setItems] = useState<CatalogAppointment[]>([]);
  const canAppointments =
    !!user && canAccess(user.role, "appointments", user.permissions);

  useEffect(() => {
    if (!canAppointments) {
      setItems([]);
      return;
    }
    const from = ymd(new Date());
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 14);
    const to = ymd(toDate);
    void api(`/catalog/appointments?from=${from}&to=${to}&limit=20`)
      .then((raw) =>
        setItems(unwrapPage<CatalogAppointment>(raw).items.slice(0, 4)),
      )
      .catch(() => setItems([]));
  }, [canAppointments]);

  return (
    <Card>
      <CardHeader title="Agenda" subtitle="Upcoming clinical schedule" />
      <div className="space-y-3 px-5 pb-5">
        {items.length === 0 ? (
          <p className="text-sm text-foreground-lighter">No upcoming appointments.</p>
        ) : (
          items.map((item) => {
            const day = Number(item.date.slice(8, 10));
            const weekday = new Date(`${item.date}T12:00:00`).toLocaleDateString(
              undefined,
              { weekday: "short" },
            );
            return (
              <Link
                key={item.id}
                href="/appointments"
                className="flex gap-3 rounded-lg bg-brand-50 p-3 transition hover:bg-brand-100/80"
              >
                <div className="flex w-10 shrink-0 flex-col items-center justify-center rounded-md bg-surface py-1.5">
                  <span className="text-base font-bold leading-tight text-brand-700">
                    {day}
                  </span>
                  <span className="text-[10px] text-foreground-lighter">{weekday}</span>
                </div>
                <div className="min-w-0">
                  <Badge tone="teal">{item.type}</Badge>
                  <p className="mt-1 truncate text-xs font-semibold text-foreground">
                    {item.patient} · {item.doctor}
                  </p>
                  <p className="mt-0.5 text-[11px] text-foreground-lighter">
                    {item.time} · {item.department}
                  </p>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </Card>
  );
}

export function DoctorsScheduleCard() {
  const { data: doctors } = useDoctors();
  const available = doctors.filter((d) => d.available);
  const unavailable = doctors.filter((d) => !d.available);
  return (
    <Card>
      <CardHeader title="Doctors' Schedule" />
      <div className="mx-4 mb-4 grid grid-cols-3 divide-x divide-brand-100 rounded-lg bg-brand-50 py-3 text-center">
        <div>
          <p className="text-lg font-bold text-brand-700">{doctors.length}</p>
          <p className="text-[11px] text-foreground-lighter">All Doctors</p>
        </div>
        <div>
          <p className="text-lg font-bold text-brand-700">{available.length}</p>
          <p className="text-[11px] text-foreground-lighter">Available</p>
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">{unavailable.length}</p>
          <p className="text-[11px] text-foreground-lighter">Unavailable</p>
        </div>
      </div>
      <ul className="space-y-1 px-3 pb-4">
        {doctors.slice(0, 6).map((doc) => (
          <li
            key={doc.id}
            className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-200"
          >
            <Avatar name={doc.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{doc.name}</p>
              <p className="truncate text-[11px] text-foreground-lighter">{doc.specialty}</p>
            </div>
            <Badge tone={doc.available ? "teal" : "red"}>
              {doc.available ? "Available" : "Unavailable"}
            </Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function RecentActivityCard() {
  const { user } = useAuth();
  const { data: summary } = useDashboardSummary();
  const showInvoices =
    user && canAccess(user.role, "billing-ledger", user.permissions);
  const activity = [
    ...(summary?.recentAppointments ?? []).slice(0, 3).map((a) => ({
      id: `appt-${a.id}`,
      title: `Appointment · ${a.patient}`,
      meta: `${a.doctor} · ${a.status}`,
      time: a.time,
    })),
    ...(showInvoices
      ? [
          {
            id: "inv",
            title: `${summary?.invoicesOpen ?? 0} open invoices`,
            meta: "Billing queue",
            time: "now",
          },
        ]
      : []),
    {
      id: "vis",
      title: `${summary?.activeVisits ?? 0} active visits`,
      meta: "Outpatient pipeline",
      time: "now",
    },
  ];

  return (
    <Card>
      <CardHeader title="Recent Activity" />
      <ul className="space-y-1 px-3 pb-4">
        {activity.map((item) => (
          <li key={item.id} className="flex items-start gap-3 rounded-xl px-2 py-2">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
              <FileText className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">{item.title}</p>
              <p className="truncate text-[11px] text-foreground-lighter">{item.meta}</p>
            </div>
            <span className="shrink-0 text-[10px] text-foreground-muted">{item.time}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
