"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BulkImportButton } from "@/components/bulk-import-button";
import { FieldLabel } from "@/components/field-label";
import { PaginationBar } from "@/components/pagination-bar";
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
import { buildListQuery, toPageMeta, unwrapPage } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [wardType, setWardType] = useState<(typeof WARD_TYPES)[number]>("GENERAL");
  const [departmentId, setDepartmentId] = useState("");
  const [dailyRate, setDailyRate] = useState("0");
  const [capacity, setCapacity] = useState("0");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildListQuery({
        active: true,
        page,
        limit: 50,
        search: search || undefined,
      });
      const res = unwrapPage<IpdWard>(await api(`/ipd/wards?${qs}`));
      setWards(res.items);
      setTotal(res.total);
      setLimit(res.limit);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load wards");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

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

  const meta = toPageMeta({ total, page, limit });

  return (
    <RoleGuard module="inpatient">
      <PageHeader
        title="IPD Wards"
        subtitle={loading ? "Loading…" : `${total.toLocaleString()} wards`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <BulkImportButton
              resource="wards"
              title="Import wards"
              description="First row is the header. Fix any invalid rows before import — partial import is not allowed."
              label="Import wards"
              onImported={load}
            />
            <PrimaryButton onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Add ward
            </PrimaryButton>
          </div>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <div className="mb-4">
        <input
          className={inputClass}
          placeholder="Search wards…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <Card>
        <CardHeader title="Wards" subtitle={`${total.toLocaleString()} total`} />
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
            <tr key={w.id} className="hover:bg-surface-200/60">
              <td className="px-5 py-3.5 font-medium text-foreground">{w.name}</td>
              <td className="px-5 py-3.5">
                <Badge>{w.wardType}</Badge>
              </td>
              <td className="px-5 py-3.5 text-foreground-light">{w.capacity}</td>
              <td className="px-5 py-3.5 text-foreground-light">{w.totalBeds}</td>
              <td className="px-5 py-3.5 text-foreground-light">{w.availableBeds}</td>
              <td className="px-5 py-3.5 text-foreground-light">{w.occupiedBeds}</td>
              <td className="px-5 py-3.5 text-foreground-light">{w.reservedBeds}</td>
              <td className="px-5 py-3.5 text-foreground-light">{w.dailyRate}</td>
              <td className="px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => void deactivate(w.id)}
                  className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground-light hover:border-rose-300 hover:text-rose-600"
                >
                  Deactivate
                </button>
              </td>
            </tr>
          ))}
        </Table>
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Add ward</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-foreground-lighter hover:bg-surface-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <FieldLabel required>Ward name</FieldLabel>
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <FieldLabel required>Type</FieldLabel>
                <select
                  className={inputClass}
                  value={wardType}
                  onChange={(e) => setWardType(e.target.value as (typeof WARD_TYPES)[number])}
                >
                  {WARD_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel optional>Department</FieldLabel>
                <select
                  className={inputClass}
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel optional>Daily rate</FieldLabel>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={dailyRate}
                  onChange={(e) => setDailyRate(e.target.value)}
                />
              </div>
              <div>
                <FieldLabel optional>Capacity</FieldLabel>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                />
              </div>
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
