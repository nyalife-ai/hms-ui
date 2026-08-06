"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import {
  Badge,
  Card,
  CardHeader,
  PageHeader,
  PrimaryButton,
  Table,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useDepartments } from "@/lib/catalog";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

const WARD_TYPES = [
  "GENERAL",
  "ICU",
  "NICU",
  "MATERNITY",
  "PEDIATRIC",
  "PRIVATE",
  "SEMI_PRIVATE",
] as const;

type IpdWard = {
  id: string;
  name: string;
  wardType: string;
  departmentId: string | null;
  dailyRate: number;
  capacity: number;
  isActive: boolean;
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  reservedBeds: number;
  maintenanceBeds: number;
};

export default function IpdWardsPage() {
  const { data: departments } = useDepartments();
  const [wards, setWards] = useState<IpdWard[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [wardType, setWardType] = useState<(typeof WARD_TYPES)[number]>("GENERAL");
  const [departmentId, setDepartmentId] = useState("");
  const [dailyRate, setDailyRate] = useState("0");
  const [capacity, setCapacity] = useState("0");

  const load = useCallback(async () => {
    try {
      const rows = await api<IpdWard[]>("/ipd/wards?active=true");
      setWards(rows);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load wards");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) {
      setError("Ward name is required");
      return;
    }
    setBusy(true);
    try {
      await api("/ipd/wards", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          wardType,
          departmentId: departmentId || undefined,
          dailyRate: Number(dailyRate) || 0,
          capacity: Number(capacity) || 0,
        }),
      });
      setOpen(false);
      setName("");
      setCapacity("0");
      setDailyRate("0");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create ward failed");
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (id: string) => {
    try {
      await api(`/ipd/wards/${id}/deactivate`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deactivate failed");
    }
  };

  return (
    <RoleGuard module="inpatient">
      <PageHeader
        title="IPD Wards"
        subtitle="Create wards and monitor occupancy from the API"
        action={
          <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add ward
          </PrimaryButton>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      <Card>
        <CardHeader title="Wards" subtitle={`${wards.length} active`} />
        <Table
          headers={[
            "Name",
            "Type",
            "Capacity",
            "Beds",
            "Available",
            "Occupied",
            "Reserved",
            "Rate",
            "Actions",
          ]}
        >
          {wards.map((w) => (
            <tr key={w.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 font-medium text-slate-800">{w.name}</td>
              <td className="px-5 py-3.5">
                <Badge>{w.wardType}</Badge>
              </td>
              <td className="px-5 py-3.5 text-slate-500">{w.capacity}</td>
              <td className="px-5 py-3.5 text-slate-500">{w.totalBeds}</td>
              <td className="px-5 py-3.5 text-slate-500">{w.availableBeds}</td>
              <td className="px-5 py-3.5 text-slate-500">{w.occupiedBeds}</td>
              <td className="px-5 py-3.5 text-slate-500">{w.reservedBeds}</td>
              <td className="px-5 py-3.5 text-slate-500">{w.dailyRate}</td>
              <td className="px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => void deactivate(w.id)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-rose-300 hover:text-rose-600"
                >
                  Deactivate
                </button>
              </td>
            </tr>
          ))}
        </Table>
        {wards.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-slate-400">No wards yet</p>
        )}
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Add ward</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ward name"
              />
              <select
                className={inputClass}
                value={wardType}
                onChange={(e) => setWardType(e.target.value as (typeof WARD_TYPES)[number])}
              >
                {WARD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select
                className={inputClass}
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">Department (optional)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <input
                className={inputClass}
                type="number"
                min={0}
                value={dailyRate}
                onChange={(e) => setDailyRate(e.target.value)}
                placeholder="Daily rate"
              />
              <input
                className={inputClass}
                type="number"
                min={0}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="Capacity"
              />
              <PrimaryButton disabled={busy} onClick={create}>
                {busy ? "Saving…" : "Create ward"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
