"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import { Card, CardHeader, PageHeader, PrimaryButton, Table } from "@/components/ui";
import { api } from "@/lib/api";

type IpdOverview = {
  wards: number;
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  reservedBeds: number;
  maintenanceBeds: number;
  activeAdmissions: number;
  todaysAdmissions: number;
  pendingReservations: number;
  recentTransfers: Array<{
    id: string;
    patientName: string;
    newWard: string;
    newBed: string;
    reason: string | null;
    at: string;
  }>;
  recentDischarges: Array<{
    id: string;
    patientName: string;
    mrn: string;
    dischargedAt: string | null;
    diagnosis: string | null;
  }>;
};

export default function IpdOverviewPage() {
  const [data, setData] = useState<IpdOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const overview = await api<IpdOverview>("/ipd/overview");
      setData(overview);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load overview");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = data
    ? [
        { label: "Active wards", value: data.wards },
        { label: "Total beds", value: data.totalBeds },
        { label: "Available", value: data.availableBeds },
        { label: "Occupied", value: data.occupiedBeds },
        { label: "Reserved", value: data.reservedBeds },
        { label: "Maintenance", value: data.maintenanceBeds },
        { label: "Active admissions", value: data.activeAdmissions },
        { label: "Admitted today", value: data.todaysAdmissions },
        { label: "Pending reservations", value: data.pendingReservations },
      ]
    : [];

  return (
    <RoleGuard module="inpatient">
      <PageHeader
        title="IPD Overview"
        subtitle={loading ? "Loading board…" : "Operational snapshot from the inpatient API"}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/inpatient/admissions">
              <PrimaryButton>Admissions</PrimaryButton>
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
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent transfers" subtitle="Latest bed movements" />
          <Table headers={["Patient", "To", "Reason", "When"]}>
            {(data?.recentTransfers ?? []).map((t) => (
              <tr key={t.id}>
                <td className="px-5 py-3 text-slate-700">{t.patientName}</td>
                <td className="px-5 py-3 text-slate-500">
                  {t.newWard} · {t.newBed}
                </td>
                <td className="px-5 py-3 text-slate-500">{t.reason || "—"}</td>
                <td className="px-5 py-3 text-slate-400 text-xs">
                  {new Date(t.at).toLocaleString()}
                </td>
              </tr>
            ))}
          </Table>
          {!data?.recentTransfers?.length && (
            <p className="px-5 py-6 text-center text-sm text-slate-400">No recent transfers</p>
          )}
        </Card>
        <Card>
          <CardHeader title="Recent discharges" subtitle="Patients released" />
          <Table headers={["Patient", "MRN", "Diagnosis", "When"]}>
            {(data?.recentDischarges ?? []).map((d) => (
              <tr key={d.id}>
                <td className="px-5 py-3 text-slate-700">{d.patientName}</td>
                <td className="px-5 py-3 text-slate-500">{d.mrn}</td>
                <td className="px-5 py-3 text-slate-500">{d.diagnosis || "—"}</td>
                <td className="px-5 py-3 text-slate-400 text-xs">
                  {d.dischargedAt ? new Date(d.dischargedAt).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </Table>
          {!data?.recentDischarges?.length && (
            <p className="px-5 py-6 text-center text-sm text-slate-400">No recent discharges</p>
          )}
        </Card>
      </div>
    </RoleGuard>
  );
}
