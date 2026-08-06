"use client";

import Link from "next/link";
import { Smartphone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { MpesaCheckoutModal } from "@/components/mpesa-checkout";
import { RoleGuard } from "@/components/role-guard";
import {
  Avatar,
  Card,
  CardHeader,
  PageHeader,
  PrimaryButton,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useFeeSchedule } from "@/lib/catalog";
import { useVisits, type Visit } from "@/lib/visits";

type PharmacyOverview = {
  medications: number;
  activeSuppliers: number;
  pendingPrescriptions: number;
  openPurchaseOrders: number;
  lowStockBatches: number;
  expiringSoonBatches: number;
  expiredBatchesWithStock: number;
  todaysDispenses: number;
};

function visitTotal(
  visit: Visit,
  fees: { consult: number; lab: number; medication: number },
) {
  const tests = visit.labOrder?.tests.length ?? 0;
  const meds = visit.prescriptions?.length ?? 0;
  return fees.consult + tests * fees.lab + meds * fees.medication;
}

export default function PharmacyOverviewPage() {
  const { fees } = useFeeSchedule();
  const { visits, refresh: refreshVisits } = useVisits();
  const [data, setData] = useState<PharmacyOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkoutVisit, setCheckoutVisit] = useState<Visit | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<PharmacyOverview>("/pharmacy/overview"));
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

  const dispenseQueue = visits.filter(
    (v) =>
      v.stage === "READY_FOR_BILLING" &&
      v.payment.method === "CASH" &&
      (v.prescriptions?.length ?? 0) > 0 &&
      !v.pharmacy?.dispensed &&
      !v.billing?.receiptId,
  );

  const stats = data
    ? [
        { label: "Medications", value: data.medications },
        { label: "Active suppliers", value: data.activeSuppliers },
        { label: "Pending Rx", value: data.pendingPrescriptions },
        { label: "Open POs", value: data.openPurchaseOrders },
        { label: "Low stock batches", value: data.lowStockBatches },
        { label: "Expiring ≤30d", value: data.expiringSoonBatches },
        { label: "Expired with stock", value: data.expiredBatchesWithStock },
        { label: "Dispenses today", value: data.todaysDispenses },
      ]
    : [];

  return (
    <RoleGuard module="pharmacy">
      <PageHeader
        title="Pharmacy"
        subtitle={
          loading
            ? "Loading board…"
            : "Stock, prescriptions, and purchase orders from /pharmacy"
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/pharmacy/prescriptions">
              <PrimaryButton>Prescriptions</PrimaryButton>
            </Link>
            <Link href="/pharmacy/purchase-orders">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
              >
                Purchase orders
              </button>
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

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card className="mb-5">
        <CardHeader
          title="Visit checkout (M-Pesa)"
          subtitle="Cash visits with prescriptions awaiting dispense & payment"
        />
        {dispenseQueue.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-slate-400">
            No cash visits with prescriptions waiting. Formal Rx queue is under Prescriptions.
          </p>
        ) : (
          <ul className="space-y-3 px-5 pb-5">
            {dispenseQueue.map((v) => (
              <li key={v.id} className="rounded-2xl bg-[#f3f7f7] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={v.patientName} />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{v.patientName}</p>
                      <p className="text-[11px] text-slate-400">
                        {v.mrn} · {v.prescriptions?.length} medication(s) · Dr {v.doctorName}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    KES {visitTotal(v, fees).toLocaleString()}
                  </p>
                </div>
                <ul className="mt-3 space-y-1 text-xs text-slate-600">
                  {v.prescriptions?.map((p, i) => (
                    <li key={i}>
                      {p.medication} — {p.dosage}, {p.frequency}, {p.duration}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setCheckoutVisit(v)}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600"
                  >
                    <Smartphone className="h-3.5 w-3.5" /> Checkout & dispense (M-Pesa)
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {checkoutVisit && (
        <MpesaCheckoutModal
          visitId={checkoutVisit.id}
          patientName={checkoutVisit.patientName}
          defaultPhone={checkoutVisit.phone}
          amount={visitTotal(checkoutVisit, fees)}
          source="PHARMACY"
          onClose={() => setCheckoutVisit(null)}
          onPaid={() => {
            void refreshVisits();
            void load();
            setCheckoutVisit(null);
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { href: "/pharmacy/medications", label: "Medications", hint: "Formulary CRUD" },
          { href: "/pharmacy/batches", label: "Batches", hint: "Lots, damage, expiry" },
          { href: "/pharmacy/suppliers", label: "Suppliers", hint: "Vendor registry" },
          { href: "/pharmacy/purchase-orders", label: "Purchase orders", hint: "Draft → send → receive" },
          { href: "/pharmacy/prescriptions", label: "Prescriptions", hint: "Create & FEFO dispense" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(23,40,46,0.05)] hover:border-brand-200"
          >
            <p className="font-semibold text-slate-800">{l.label}</p>
            <p className="mt-1 text-xs text-slate-400">{l.hint}</p>
          </Link>
        ))}
      </div>
    </RoleGuard>
  );
}
