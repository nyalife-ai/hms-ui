"use client";

import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useState } from "react";
import { useAppointments, useDoctors, useDashboardSummary } from "@/lib/catalog";
import { useAuth } from "@/lib/auth";
import { canAccess } from "@/lib/roles";
import { Avatar, Badge, Card, CardHeader } from "./ui";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildMonthGrid(year: number, monthIndex: number): (number | null)[] {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startPad = first.getDay();
  const cells: (number | null)[] = Array.from({ length: startPad }, () => null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function MiniCalendar() {
  const now = new Date();
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const isCurrentMonth =
    year === now.getFullYear() && monthIndex === now.getMonth();
  const today = now.getDate();
  const grid = buildMonthGrid(year, monthIndex);
  const { data: appointments } = useAppointments();
  const marked = new Set(
    appointments
      .filter((a) => a.date.startsWith(`${year}-${String(monthIndex + 1).padStart(2, "0")}`))
      .map((a) => Number(a.date.slice(8, 10))),
  );
  const title = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });

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
        {grid.map((day, i) => (
          <span key={i} className="flex justify-center">
            {day === null ? (
              <span className="h-7 w-7" />
            ) : (
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full ${
                  isCurrentMonth && day === today
                    ? "bg-brand-500 font-semibold text-white"
                    : marked.has(day)
                      ? "bg-brand-100 font-medium text-brand-700"
                      : "text-foreground-light"
                }`}
              >
                {day}
              </span>
            )}
          </span>
        ))}
      </div>
    </Card>
  );
}

export function AgendaCard() {
  const { data: appointments } = useAppointments();
  const upcoming = appointments.slice(0, 4);

  return (
    <Card>
      <CardHeader title="Agenda" subtitle="From clinical schedule" />
      <div className="space-y-3 px-5 pb-5">
        {upcoming.length === 0 ? (
          <p className="text-sm text-foreground-lighter">No upcoming appointments.</p>
        ) : (
          upcoming.map((item) => {
            const day = Number(item.date.slice(8, 10));
            const weekday = new Date(`${item.date}T12:00:00`).toLocaleDateString(undefined, {
              weekday: "short",
            });
            return (
              <div key={item.id} className="flex gap-3 rounded-lg bg-brand-50 p-3">
                <div className="flex w-10 shrink-0 flex-col items-center justify-center rounded-md bg-surface py-1.5">
                  <span className="text-base font-bold leading-tight text-brand-700">{day}</span>
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
              </div>
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
