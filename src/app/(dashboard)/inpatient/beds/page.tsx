"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { buildListQuery, toPageMeta, unwrapPage } from "@/lib/pagination";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type IpdWard = { id: string; name: string };
type IpdBed = {
  id: string;
  wardId: string;
  wardName: string;
  bedNumber: string;
  status: string;
};

const STATUSES = ["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"] as const;

export default function IpdBedsPage() {
  const [wards, setWards] = useState<IpdWard[]>([]);
  const [beds, setBeds] = useState<IpdBed[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [wardFilter, setWardFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wardId, setWardId] = useState("");
  const [bedNumbers, setBedNumbers] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildListQuery({
        wardId: wardFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit: 50,
      });
      const [w, b] = await Promise.all([
        api("/ipd/wards?active=true&limit=100"),
        api(`/ipd/beds?${qs}`),
      ]);
      setWards(unwrapPage<IpdWard>(w).items.map((x) => ({ id: x.id, name: x.name })));
      const bedPage = unwrapPage<IpdBed>(b);
      setBeds(bedPage.items);
      setTotal(bedPage.total);
      setLimit(bedPage.limit);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load beds");
    } finally {
      setLoading(false);
    }
  }, [wardFilter, statusFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!wardId || !bedNumbers.trim()) {
      setError("Select ward and enter bed number(s)");
      return;
    }
    const numbers = bedNumbers
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    setBusy(true);
    try {
      if (numbers.length === 1) {
        await api("/ipd/beds", {
          method: "POST",
          body: JSON.stringify({ wardId, bedNumber: numbers[0] }),
        });
      } else {
        await api("/ipd/beds/bulk", {
          method: "POST",
          body: JSON.stringify({ wardId, bedNumbers: numbers }),
        });
      }
      setOpen(false);
      setBedNumbers("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create bed failed");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (bedId: string, status: string) => {
    try {
      await api(`/ipd/beds/${bedId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status change failed");
    }
  };

  const meta = toPageMeta({ total, page, limit });

  return (
    <RoleGuard module="inpatient">
      <PageHeader
        title="IPD Beds"
        subtitle={loading ? "Loading…" : `${total.toLocaleString()} beds`}
        action={
          <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add bed(s)
          </PrimaryButton>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          className={`${inputClass} max-w-xs`}
          value={wardFilter}
          onChange={(e) => {
            setWardFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All wards</option>
          {wards.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <select
          className={`${inputClass} max-w-xs`}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardHeader title="Beds" subtitle={`${total.toLocaleString()} total`} />
        <Table headers={["Ward", "Bed", "Status", "Actions"]}>
          {beds.map((b) => (
            <tr key={b.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 text-slate-700">{b.wardName}</td>
              <td className="px-5 py-3.5 font-medium text-slate-800">{b.bedNumber}</td>
              <td className="px-5 py-3.5">
                <Badge
                  tone={
                    b.status === "AVAILABLE"
                      ? "green"
                      : b.status === "OCCUPIED"
                        ? "amber"
                        : b.status === "RESERVED"
                          ? "blue"
                          : "slate"
                  }
                >
                  {b.status}
                </Badge>
              </td>
              <td className="px-5 py-3.5">
                <div className="flex flex-wrap gap-2">
                  {b.status === "AVAILABLE" && (
                    <button
                      type="button"
                      onClick={() => void setStatus(b.id, "MAINTENANCE")}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                    >
                      Maintenance
                    </button>
                  )}
                  {b.status === "MAINTENANCE" && (
                    <button
                      type="button"
                      onClick={() => void setStatus(b.id, "AVAILABLE")}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                    >
                      Mark available
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Add bed(s)</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <FieldLabel required>Ward</FieldLabel>
                <select className={inputClass} value={wardId} onChange={(e) => setWardId(e.target.value)}>
                  <option value="">Select ward</option>
                  {wards.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel required>Bed numbers</FieldLabel>
                <textarea
                  className={`${inputClass} min-h-24 resize-y`}
                  value={bedNumbers}
                  onChange={(e) => setBedNumbers(e.target.value)}
                  placeholder="Comma or newline separated, e.g. A1, A2, A3"
                />
              </div>
              <PrimaryButton disabled={busy} onClick={create}>
                {busy ? "Creating…" : "Create"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
