"use client";

import { ArrowLeft, MoreVertical } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  PageHeader,
  Table,
  type BadgeTone,
} from "@/components/ui";
import { api } from "@/lib/api";
import type { PatientDetail } from "@/lib/catalog";

const STATUS_TONES: Record<string, BadgeTone> = {
  Pending: "amber",
  Scheduled: "blue",
  "Checked In": "teal",
  Completed: "green",
  Cancelled: "red",
  IN_PROGRESS: "amber",
  COMPLETED: "green",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function PatientProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api<PatientDetail>(`/catalog/patients/${id}`);
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
  }, [id]);

  return (
    <RoleGuard module="patients">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Home / Patients / {detail?.mrn ?? "Patient"}
      </div>
      <PageHeader
        title={detail?.mrn ?? "Patient record"}
        subtitle={
          detail
            ? `${detail.name} · REF: ${detail.referenceCode}`
            : loading
              ? "Loading…"
              : "Patient profile"
        }
        action={
          <Link
            href="/patients"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to registry
          </Link>
        }
      />

      {error && <p className="mb-3 text-sm text-rose-500">{error}</p>}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      )}

      {detail && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Age", value: detail.age > 0 ? String(detail.age) : "—" },
              { label: "Scheduled visits", value: String(detail.counts.scheduledVisits) },
              { label: "Consultations", value: String(detail.counts.consultations) },
              { label: "Vitals on file", value: String(detail.counts.vitals) },
            ].map((s) => (
              <Card key={s.label} className="p-4">
                <p className="text-xs text-slate-400">{s.label}</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{s.value}</p>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
            <Card>
              <CardHeader
                title="Patient profile"
                action={<Avatar name={detail.name} size="sm" />}
              />
              <div className="space-y-2 px-5 pb-5 text-sm">
                <p className="text-base font-bold text-slate-900">{detail.name}</p>
                <p className="text-xs text-slate-400">PAT-ID: {detail.mrn}</p>
                <p className="text-xs text-slate-400">REF: {detail.referenceCode}</p>
                <p className="pt-2">
                  <span className="text-xs text-slate-400">Phone</span>
                  <br />
                  <span className="font-medium">{detail.phone || "—"}</span>
                </p>
                <p>
                  <span className="text-xs text-slate-400">Email</span>
                  <br />
                  <span className="font-medium">{detail.email || "—"}</span>
                </p>
                <p>
                  <span className="text-xs text-slate-400">Date of birth</span>
                  <br />
                  <span className="font-medium">{detail.dateOfBirth || "—"}</span>
                </p>
                <p>
                  <span className="text-xs text-slate-400">Registered</span>
                  <br />
                  <span className="font-medium">{formatDate(detail.registeredAt)}</span>
                </p>
              </div>
            </Card>

            <Card>
              <CardHeader title="Emergency contact" />
              <div className="space-y-2 px-5 pb-5 text-sm">
                <p>
                  <span className="text-xs text-slate-400">Next of kin</span>
                  <br />
                  <span className="font-semibold">
                    {detail.emergencyContact?.name || "Not specified"}
                  </span>
                </p>
                <p>
                  <span className="text-xs text-slate-400">Contact line</span>
                  <br />
                  <span className="font-medium">
                    {detail.emergencyContact?.phone || "—"}
                  </span>
                </p>
              </div>
            </Card>

            <Card>
              <CardHeader title="Demographics & biometrics" />
              <div className="space-y-2 px-5 pb-5 text-sm">
                <p className="text-xs font-semibold text-slate-500">Physical profile</p>
                <div className="grid grid-cols-2 gap-2">
                  <p>
                    <span className="text-xs text-slate-400">Height</span>
                    <br />
                    {detail.physical.height != null
                      ? `${detail.physical.height} cm`
                      : "—"}
                  </p>
                  <p>
                    <span className="text-xs text-slate-400">Weight</span>
                    <br />
                    {detail.physical.weight != null
                      ? `${detail.physical.weight} kg`
                      : "—"}
                  </p>
                </div>
                <p>
                  <span className="text-xs text-slate-400">Occupation</span>
                  <br />
                  {detail.occupation || "—"}
                </p>
                <p>
                  <span className="text-xs text-slate-400">Prescriptions</span>{" "}
                  <span className="font-semibold">{detail.counts.prescriptions}</span>
                </p>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Latest vitals snapshot" />
            <div className="px-5 pb-5 text-sm text-slate-600">
              {!detail.latestVitals ? (
                <p className="text-slate-400">No vitals recorded yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <p>
                    BP{" "}
                    <span className="font-semibold">
                      {detail.latestVitals.bloodPressure || "—"}
                    </span>
                  </p>
                  <p>
                    Pulse{" "}
                    <span className="font-semibold">
                      {detail.latestVitals.heartRate ?? "—"}
                    </span>
                  </p>
                  <p>
                    Temp{" "}
                    <span className="font-semibold">
                      {detail.latestVitals.temperature ?? "—"}
                    </span>
                  </p>
                  <p>
                    SpO₂{" "}
                    <span className="font-semibold">
                      {detail.latestVitals.oxygenSaturation ?? "—"}
                    </span>
                  </p>
                  <p>
                    Weight{" "}
                    <span className="font-semibold">
                      {detail.latestVitals.weight ?? "—"}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400 sm:col-span-3">
                    Measured {formatDate(detail.latestVitals.measuredAt)}
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Visit timeline" />
            <Table headers={["Encounter", "When", "Provider", "Status", ""]}>
              {(detail.visitTimeline ?? detail.appointments.map((a) => ({
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
              }))).map((item) => (
                <tr key={`${item.kind}-${item.id}`} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    <Link href={item.href} className="hover:text-brand-700">
                      {item.label}
                    </Link>
                    {item.summary ? (
                      <p className="text-xs font-normal text-slate-400">
                        {item.summary}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {item.date}
                    <br />
                    <span className="text-xs">{item.time}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{item.provider}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={STATUS_TONES[item.status] ?? "slate"}>
                      {item.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={item.href}
                      className="text-xs font-semibold text-brand-700 hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </Table>
            {(detail.visitTimeline?.length ?? detail.appointments.length) === 0 && (
              <p className="px-5 pb-5 text-sm text-slate-400">No visits on file.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Consultations" />
            <Table headers={["Record", "Date", "Physician", "Diagnosis", "Status", "Actions"]}>
              {detail.consultations.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    {c.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {new Date(c.date).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{c.physician}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.diagnosis}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={STATUS_TONES[c.status] ?? "slate"}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-slate-300">
                    <MoreVertical className="h-4 w-4" />
                  </td>
                </tr>
              ))}
            </Table>
            {detail.consultations.length === 0 && (
              <p className="px-5 pb-5 text-sm text-slate-400">
                No consultations on file.
              </p>
            )}
          </Card>
        </div>
      )}
    </RoleGuard>
  );
}
