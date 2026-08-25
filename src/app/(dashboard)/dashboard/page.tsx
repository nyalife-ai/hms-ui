"use client";

import type { LucideIcon } from "lucide-react";
import {
  Users,
  CalendarDays,
  UserRound,
  ArrowRight,
  ChevronRight,
  AlertCircle,
  Building2,
  UserCog,
  Settings,
  Receipt,
  ClipboardPlus,
  Activity,
  ConciergeBell,
  Pill,
  FlaskConical,
  ScanLine,
  BedDouble,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { type Role } from "@/lib/roles";
import { useDashboardSummary, type DashboardSummary } from "@/lib/catalog";
import { Avatar, Badge, Card, CardHeader, StatCard, Table, cell, type BadgeTone } from "@/components/ui";
import { PageLayout, ScaffoldContainer } from "@/components/studio";
import { AgeStagesChart, DepartmentsDonut, RevenueLineChart } from "@/components/charts";
import {
  AgendaCard,
  DoctorsScheduleCard,
  MiniCalendar,
  RecentActivityCard,
} from "@/components/dashboard-rail";

const APPOINTMENT_TONES: Record<string, BadgeTone> = {
  Scheduled: "slate",
  "Checked In": "blue",
  Completed: "teal",
  Cancelled: "red",
};

type DeskCopy = {
  title: string;
  subtitle: (firstName: string) => string;
};

const DESK_COPY: Record<Role, DeskCopy> = {
  SUPER_ADMIN: {
    title: "Hospital Management",
    subtitle: (n) =>
      `Hello ${n} — oversee hospital operations, users, departments, and system administration.`,
  },

  ADMIN: {
    title: "Hospital Administration",
    subtitle: (n) =>
      `Hello ${n} — manage staff, departments, hospital services, and daily operations.`,
  },

  DOCTOR: {
    title: "Clinical Workspace",
    subtitle: (n) =>
      `Hello ${n} — manage consultations, patient care, clinical records, and your schedule.`,
  },

  NURSE: {
    title: "Nursing Workspace",
    subtitle: (n) =>
      `Hello ${n} — manage patient care, observations, triage, and nursing activities.`,
  },

  RECEPTIONIST: {
    title: "Reception & Patient Services",
    subtitle: (n) =>
      `Hello ${n} — manage patient registration, appointments, check-ins, and front-desk services.`,
  },

  PHARMACIST: {
    title: "Pharmacy Management",
    subtitle: (n) =>
      `Hello ${n} — manage prescriptions, medication dispensing, inventory, and pharmacy services.`,
  },

  LAB_TECHNICIAN: {
    title: "Laboratory Services",
    subtitle: (n) =>
      `Hello ${n} — manage laboratory requests, patient samples, tests, and results.`,
  },

  RADIOLOGIST: {
    title: "Radiology Services",
    subtitle: (n) =>
      `Hello ${n} — manage imaging requests, examinations, reports, and radiology findings.`,
  },

  ACCOUNTANT: {
    title: "Hospital Finance",
    subtitle: (n) =>
      `Hello ${n} — manage billing, invoices, payments, financial records, and hospital accounts.`,
  },
};

type WorkspaceLink = { href: string; label: string; icon: LucideIcon };

const WORKSPACE: Partial<Record<Role, { title: string; subtitle: string; links: WorkspaceLink[] }>> = {
  SUPER_ADMIN: {
    title: "Hospital overview",
    subtitle: "Full access to every hospital desk and administrative tools",
    links: [
      { href: "/front-desk", label: "Front desk", icon: ConciergeBell },
      { href: "/consultations", label: "Consultations", icon: ClipboardPlus },
      { href: "/pharmacy", label: "Pharmacy", icon: Pill },
      { href: "/laboratory", label: "Laboratory", icon: FlaskConical },
      { href: "/radiology", label: "Radiology", icon: ScanLine },
      { href: "/inpatient", label: "IPD", icon: BedDouble },
      { href: "/staff", label: "Staff & roles", icon: UserCog },
      { href: "/billing", label: "Billing", icon: Receipt },
    ],
  },
  ADMIN: {
    title: "Administrator workspace",
    subtitle: "Configuration and oversight — OPD desks are staffed by reception, nursing, and doctors",
    links: [
      { href: "/staff", label: "Staff & roles", icon: UserCog },
      { href: "/departments", label: "Departments", icon: Building2 },
      { href: "/billing", label: "Billing", icon: Receipt },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
  DOCTOR: {
    title: "Clinical workspace",
    subtitle: "Your desk only — pharmacy, lab, and radiology are operated by those departments",
    links: [
      { href: "/consultations", label: "Consultations", icon: ClipboardPlus },
      { href: "/patients", label: "Patients", icon: Users },
      { href: "/appointments", label: "Appointments", icon: CalendarDays },
      { href: "/inpatient", label: "IPD", icon: BedDouble },
    ],
  },
  NURSE: {
    title: "Nursing workspace",
    subtitle: "Triage and ward care — registration and consults belong to other desks",
    links: [
      { href: "/triage", label: "Triage", icon: Activity },
      { href: "/patients", label: "Patients", icon: Users },
      { href: "/inpatient", label: "IPD", icon: BedDouble },
      { href: "/appointments", label: "Schedule", icon: CalendarDays },
    ],
  },
  RECEPTIONIST: {
    title: "Front desk workspace",
    subtitle: "Registration, appointments, and payments",
    links: [
      { href: "/front-desk", label: "Front desk", icon: ConciergeBell },
      { href: "/appointments", label: "Appointments", icon: CalendarDays },
      { href: "/patients", label: "Patients", icon: Users },
      { href: "/billing", label: "Billing", icon: Receipt },
    ],
  },
  PHARMACIST: {
    title: "Pharmacy workspace",
    subtitle: "Dispense and manage inventory from this desk",
    links: [
      { href: "/pharmacy", label: "Pharmacy overview", icon: Pill },
      { href: "/pharmacy/prescriptions", label: "Prescriptions", icon: ClipboardPlus },
      { href: "/pharmacy/medications", label: "Medications", icon: Pill },
      { href: "/messages", label: "Messages", icon: MessageSquare },
    ],
  },
  LAB_TECHNICIAN: {
    title: "Laboratory workspace",
    subtitle: "Process requests and publish results from this desk",
    links: [
      { href: "/laboratory", label: "Lab overview", icon: FlaskConical },
      { href: "/laboratory/requests", label: "Requests", icon: ClipboardPlus },
      { href: "/laboratory/samples", label: "Samples", icon: FlaskConical },
      { href: "/laboratory/results", label: "Results", icon: Activity },
    ],
  },
  RADIOLOGIST: {
    title: "Radiology workspace",
    subtitle: "Imaging queue and findings from this desk",
    links: [
      { href: "/radiology", label: "Radiology queue", icon: ScanLine },
      { href: "/messages", label: "Messages", icon: MessageSquare },
    ],
  },
  ACCOUNTANT: {
    title: "Finance workspace",
    subtitle: "Invoices and settlement — clinical desks are separate",
    links: [
      { href: "/billing", label: "Billing", icon: Receipt },
      { href: "/messages", label: "Messages", icon: MessageSquare },
    ],
  },
};

function reportHref(source: string, role: Role): string {
  if (source === "Billing") {
    return role === "ACCOUNTANT" ||
      role === "RECEPTIONIST" ||
      role === "ADMIN" ||
      role === "SUPER_ADMIN"
      ? "/billing/invoices"
      : "/dashboard";
  }
  if (source === "Scheduling") {
    return role === "ADMIN" ||
      role === "SUPER_ADMIN" ||
      role === "DOCTOR" ||
      role === "NURSE" ||
      role === "RECEPTIONIST"
      ? "/appointments"
      : "/dashboard";
  }
  if (source === "Outpatient" || source === "Front desk") {
    if (role === "RECEPTIONIST") return "/front-desk";
    if (role === "DOCTOR") return "/consultations";
    if (role === "NURSE") return "/triage";
    if (role === "ADMIN" || role === "SUPER_ADMIN") return "/appointments";
    return "/dashboard";
  }
  return "/dashboard";
}

function RoleStats({
  role,
  summary,
}: {
  role: Role;
  summary: DashboardSummary | null;
}) {
  const activeVisits = String(summary?.activeVisits ?? 0);
  const patients = String(summary?.patients ?? 0);
  const appts = String(summary?.appointmentsToday ?? 0);
  const invoices = String(summary?.invoicesOpen ?? 0);
  const doctors = String(summary?.doctors ?? 0);

  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      return (
        <>
          <StatCard label="Clinical staff" value={doctors} deltaLabel="doctors in directory" icon={Users} />
          <StatCard label="Open invoices" value={invoices} deltaLabel="awaiting settlement" icon={Receipt} />
          <StatCard label="Active visits" value={activeVisits} deltaLabel="outpatient load (oversight)" icon={UserRound} />
        </>
      );
    case "DOCTOR":
      return (
        <>
          <StatCard label="Appointments today" value={appts} deltaLabel="on your clinical schedule" icon={CalendarDays} />
          <StatCard label="Active visits" value={activeVisits} deltaLabel="in outpatient pipeline" icon={UserRound} />
          <StatCard label="Patients" value={patients} deltaLabel="registered in HMS" icon={Users} />
        </>
      );
    case "NURSE":
      return (
        <>
          <StatCard label="Active visits" value={activeVisits} deltaLabel="awaiting triage / care" icon={UserRound} />
          <StatCard label="Patients" value={patients} deltaLabel="registered in HMS" icon={Users} />
          <StatCard label="Appointments today" value={appts} deltaLabel="on clinical schedule" icon={CalendarDays} />
        </>
      );
    case "RECEPTIONIST":
      return (
        <>
          <StatCard label="Active visits" value={activeVisits} deltaLabel="in outpatient pipeline" icon={UserRound} />
          <StatCard label="Appointments today" value={appts} deltaLabel="to check in / schedule" icon={CalendarDays} />
          <StatCard label="Open invoices" value={invoices} deltaLabel="awaiting settlement" icon={Receipt} />
        </>
      );
    case "ACCOUNTANT":
      return (
        <>
          <StatCard label="Open invoices" value={invoices} deltaLabel="awaiting settlement" icon={Receipt} />
          <StatCard label="Patients" value={patients} deltaLabel="billing accounts" icon={Users} />
          <StatCard label="Appointments today" value={appts} deltaLabel="volume context" icon={CalendarDays} />
        </>
      );
    case "PHARMACIST":
      return (
        <>
          <StatCard label="Active visits" value={activeVisits} deltaLabel="possible dispense demand" icon={UserRound} />
          <StatCard label="Open invoices" value={invoices} deltaLabel="billing context" icon={Receipt} />
          <StatCard label="Messages" value="—" deltaLabel="use Pharmacy workspace below" icon={MessageSquare} />
        </>
      );
    case "LAB_TECHNICIAN":
      return (
        <>
          <StatCard label="Active visits" value={activeVisits} deltaLabel="possible lab demand" icon={UserRound} />
          <StatCard label="Patients" value={patients} deltaLabel="registered in HMS" icon={Users} />
          <StatCard label="Appointments today" value={appts} deltaLabel="volume context" icon={CalendarDays} />
        </>
      );
    case "RADIOLOGIST":
      return (
        <>
          <StatCard label="Active visits" value={activeVisits} deltaLabel="possible imaging demand" icon={UserRound} />
          <StatCard label="Patients" value={patients} deltaLabel="registered in HMS" icon={Users} />
          <StatCard label="Appointments today" value={appts} deltaLabel="volume context" icon={CalendarDays} />
        </>
      );
    default:
      return null;
  }
}

function WorkspaceCard({ role }: { role: Role }) {
  const desk = WORKSPACE[role];
  if (!desk) return null;
  return (
    <Card>
      <CardHeader title={desk.title} subtitle={desk.subtitle} />
      <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-4">
        {desk.links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-lg bg-surface-200 px-3 py-3 text-sm font-medium text-foreground transition hover:bg-brand-50 hover:text-brand-700"
          >
            <item.icon className="h-4 w-4 shrink-0 text-brand-600" />
            {item.label}
          </Link>
        ))}
      </div>
    </Card>
  );
}

function AppointmentsTable({
  title,
  appointments,
}: {
  title: string;
  appointments: NonNullable<DashboardSummary["recentAppointments"]>;
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        action={
          <Link
            href="/appointments"
            className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <Table headers={["Name", "Doctor (+ Specialty)", "Appointment Type", "Date & Time", "Status"]}>
        {appointments.map((a) => (
          <tr key={a.id} className="transition hover:bg-surface-200/60">
            <td className={cell}>
              <div className="flex items-center gap-3">
                <Avatar name={a.patient} size="sm" />
                <span className="font-semibold text-foreground">{a.patient}</span>
              </div>
            </td>
            <td className={cell}>
              <span className="block text-foreground">{a.doctor}</span>
              <span className="text-xs text-foreground-lighter">{a.department}</span>
            </td>
            <td className={`${cell} text-foreground-light`}>{a.type}</td>
            <td className={cell}>
              <span className="block text-foreground">{a.date}</span>
              <span className="text-xs text-foreground-lighter">{a.time}</span>
            </td>
            <td className={cell}>
              <Badge tone={APPOINTMENT_TONES[a.status]}>{a.status}</Badge>
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: summary } = useDashboardSummary();
  if (!user) return null;

  const role = user.role;
  const firstName = user.name.replace(/^Dr\.\s*/, "").split(" ")[0];
  const copy = DESK_COPY[role];
  const appointments = summary?.recentAppointments ?? [];
  const LOGO_COLORS = ["#f02878", "#1aa8b0", "#40c0b0", "#d91a66", "#0d8a96", "#ff85b3"];
  const deptDistribution = (summary?.deptDistribution ?? []).map((d, i) => ({
    ...d,
    color: LOGO_COLORS[i % LOGO_COLORS.length],
  }));
  const ageStages = summary?.ageStages ?? [];
  const revenueSeries = summary?.revenueSeries ?? [];
  const reports = summary?.reports ?? [];

  const showHospitalCharts = role === "ADMIN" || role === "SUPER_ADMIN";
  const showRevenue =
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    role === "RECEPTIONIST" ||
    role === "ACCOUNTANT";
  const showAppointments =
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    role === "DOCTOR" ||
    role === "NURSE" ||
    role === "RECEPTIONIST";
  const showDoctorsRail = role === "RECEPTIONIST" || role === "SUPER_ADMIN";
  const showReports =
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    role === "RECEPTIONIST" ||
    role === "ACCOUNTANT" ||
    role === "DOCTOR" ||
    role === "NURSE";

  const appointmentTitle =
    role === "ADMIN" || role === "SUPER_ADMIN"
      ? "Schedule snapshot"
      : role === "DOCTOR"
        ? "Your schedule"
        : "Patient appointments";

  return (
    <PageLayout title={copy.title} subtitle={copy.subtitle(firstName)}>
      <ScaffoldContainer className="pb-8 pt-6">
    <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <RoleStats role={role} summary={summary} />
        </div>

        <WorkspaceCard role={role} />

        {showHospitalCharts && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
            <Card>
              <CardHeader
                title="Patient by Age Stages"
                subtitle={`Total Patients ${summary?.patients ?? 0}`}
              />
              <div className="px-3 pb-3">
                <AgeStagesChart data={ageStages} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Appointments by specialty" />
              <div className="px-4 pb-2">
                <DepartmentsDonut data={deptDistribution} />
              </div>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-2 px-5 pb-5">
                {deptDistribution.length === 0 ? (
                  <li className="col-span-2 text-[11px] text-foreground-lighter">No specialty volume yet.</li>
                ) : (
                  deptDistribution.map((d) => (
                    <li key={d.name} className="flex items-center gap-2 text-[11px]">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">{d.name}</span>
                        <span className="text-foreground-lighter">{d.value.toLocaleString()} appointments</span>
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </Card>
          </div>
        )}

        {(showRevenue || showReports) && (
          <div className={`grid grid-cols-1 gap-4 ${showRevenue ? "xl:grid-cols-[1.6fr_1fr]" : ""}`}>
            {showRevenue && (
              <Card>
                <CardHeader title="Revenue" subtitle="From invoices in the database" />
                <div className="px-3 pb-3">
                  <RevenueLineChart data={revenueSeries} />
                </div>
              </Card>
            )}
            {showReports && (
              <Card>
                <CardHeader title="Live reports" />
                <ul className="space-y-1 px-3 pb-4">
                  {reports.length === 0 ? (
                    <li className="px-2 py-4 text-sm text-foreground-lighter">No operational alerts right now.</li>
                  ) : (
                    reports.map((report) => {
                      const href = reportHref(report.source, role);
                      return (
                        <li key={report.id}>
                          <Link
                            href={href}
                            className="flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-brand-50/60"
                          >
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                              <AlertCircle className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold leading-snug text-foreground">{report.title}</p>
                              <p className="mt-0.5 text-[11px] text-foreground-lighter">
                                {report.source} · {report.time}
                              </p>
                            </div>
                            <span className="flex shrink-0 items-center text-[11px] font-medium text-brand-600">
                              Open <ChevronRight className="h-3 w-3" />
                            </span>
                          </Link>
                        </li>
                      );
                    })
                  )}
                </ul>
              </Card>
            )}
          </div>
        )}

        {showAppointments && (
          <AppointmentsTable title={appointmentTitle} appointments={appointments} />
        )}
      </div>

      <div className="space-y-5">
        <MiniCalendar />
        <AgendaCard />
        {showDoctorsRail && <DoctorsScheduleCard />}
        <RecentActivityCard />
      </div>
    </div>
      </ScaffoldContainer>
    </PageLayout>
  );
}
