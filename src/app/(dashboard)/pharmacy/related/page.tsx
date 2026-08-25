"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import {
  Badge,
  Card,
  CardHeader,
  PageHeader,
  Table,
  type BadgeTone,
} from "@/components/ui";
import { api } from "@/lib/api";
import { consultationJourneyHref } from "@/lib/clinical-links";
import { buildListQuery, unwrapPage } from "@/lib/pagination";

const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "amber",
  PARTIALLY_DISPENSED: "teal",
  DISPENSED: "green",
  CANCELLED: "slate",
  PRESCRIBED: "blue",
};

type Rx = {
  id: string;
  prescriptionNumber: string | null;
  patientName: string;
  mrn: string;
  prescribedBy: string;
  prescriptionDate?: string;
  status: string;
  lines: Array<{
    id: string;
    medicationName: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    quantity: number;
    status: string;
  }>;
};

function RelatedPrescriptionsInner() {
  const params = useSearchParams();
  const visitId = params.get("visitId") || "";
  const appointmentId = params.get("appointmentId") || "";
  const patient = params.get("patient") || "";
  const [rows, setRows] = useState<Rx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!visitId && !appointmentId) {
      setRows([]);
      setLoading(false);
      setError("No visit or appointment was provided.");
      return;
    }
    setLoading(true);
    try {
      const qs = buildListQuery({
        visitId: visitId || undefined,
        appointmentId: appointmentId || undefined,
        page: 1,
        limit: 100,
      });
      const r = await api(`/pharmacy/prescriptions?${qs}`);
      setRows(unwrapPage<Rx>(r).items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load prescriptions");
    } finally {
      setLoading(false);
    }
  }, [visitId, appointmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const backHref = visitId ? consultationJourneyHref(visitId) : "/appointments";

  return (
    <RoleGuard modules={["consultations", "appointments", "pharmacy"]}>
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-foreground-lighter">
        Home / Pharmacy / Related prescriptions
      </div>
      <PageHeader
        title="Related prescriptions"
        subtitle={
          loading
            ? "Loading…"
            : `${rows.length} prescription${rows.length === 1 ? "" : "s"}${
                patient ? ` · ${patient}` : ""
              }`
        }
        action={
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-brand-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      <Card>
        <CardHeader
          title="Prescriptions for this visit"
          subtitle="Orders written during consultation"
        />
        <Table
          headers={["Rx number", "Patient", "Prescribing doctor", "Medications", "Status"]}
        >
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-surface-200/60">
              <td className="px-5 py-3.5 font-medium text-foreground">
                {r.prescriptionNumber || r.id.slice(0, 8)}
              </td>
              <td className="px-5 py-3.5 text-foreground-light">
                {r.patientName}
                <span className="block text-xs text-foreground-lighter">MRN {r.mrn}</span>
              </td>
              <td className="px-5 py-3.5 text-foreground-light">{r.prescribedBy}</td>
              <td className="px-5 py-3.5 text-xs text-foreground-light">
                {r.lines.map((l) => (
                  <div key={l.id}>
                    {l.medicationName}
                    {l.dosage ? ` — ${l.dosage}` : ""}
                    {l.frequency ? ` · ${l.frequency}` : ""}
                    {l.duration ? ` · ${l.duration}` : ""}
                  </div>
                ))}
              </td>
              <td className="px-5 py-3.5">
                <Badge tone={STATUS_TONE[r.status] ?? "slate"}>{r.status}</Badge>
              </td>
            </tr>
          ))}
        </Table>
        {!loading && rows.length === 0 && !error && (
          <p className="px-5 py-10 text-center text-sm text-foreground-lighter">
            No prescriptions are linked to this appointment yet.
          </p>
        )}
      </Card>
    </RoleGuard>
  );
}

export default function RelatedPrescriptionsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-foreground-lighter">Loading…</p>}>
      <RelatedPrescriptionsInner />
    </Suspense>
  );
}
