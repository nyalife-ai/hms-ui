"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PaginationBar } from "@/components/pagination-bar";
import { RecordInvoicePaymentModal } from "@/components/record-invoice-payment-modal";
import { RoleGuard } from "@/components/role-guard";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  PageHeader,
  PrimaryButton,
  Table,
  type BadgeTone,
} from "@/components/ui";
import { api } from "@/lib/api";
import { buildListQuery, toPageMeta, unwrapPage } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useVisits } from "@/lib/visits";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type PaymentRow = {
  id: string;
  paymentNumber: string;
  patientName: string;
  patientMrn: string;
  amount: string;
  allocated: string;
  unallocated: string;
  methodCode: string | null;
  transactionReference: string | null;
  paymentDate: string;
  status: string;
};

const STATUS_TONES: Record<string, BadgeTone> = {
  COMPLETED: "green",
  PENDING: "blue",
  FAILED: "red",
  CANCELLED: "slate",
};

function formatKes(v: string | number) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v);
}

function formatDate(v: string | null | undefined) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
}

export default function BillingPaymentsPage() {
  const { refresh: refreshVisits } = useVisits();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildListQuery({
        page,
        limit: 50,
        search: search || undefined,
      });
      const payments = await api(`/billing/payments?${qs}`);
      const res = unwrapPage<PaymentRow>(payments);
      setRows(res.items);
      setTotal(res.total);
      setLimit(res.limit);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payments");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const meta = toPageMeta({ total, page, limit });

  return (
    <RoleGuard module="billing">
      <PageHeader
        title="Payments"
        subtitle={loading ? "Loading…" : `${total.toLocaleString()} payments`}
        action={
          <PrimaryButton
            onClick={() => {
              setNotice("");
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Record payment
          </PrimaryButton>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      {notice && (
        <p className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">{notice}</p>
      )}
      <div className="mb-4">
        <input
          className={inputClass}
          placeholder="Search payment #, reference, or patient…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <Card>
        <CardHeader title="Payment register" subtitle={`${total.toLocaleString()} records`} />
        <Table
          headers={["Payment", "Patient", "Method", "Amount", "Unallocated", "Date", "Status"]}
        >
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3.5 font-semibold text-slate-800">
                {p.paymentNumber}
                {p.transactionReference && (
                  <span className="block text-[11px] font-normal text-slate-400">
                    {p.transactionReference}
                  </span>
                )}
              </td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={p.patientName} size="sm" />
                  <div>
                    <p className="text-sm text-slate-700">{p.patientName}</p>
                    <p className="text-[11px] text-slate-400">{p.patientMrn}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3.5 text-slate-500">{p.methodCode || "—"}</td>
              <td className="px-5 py-3.5 text-slate-600">{formatKes(p.amount)}</td>
              <td className="px-5 py-3.5 text-slate-600">{formatKes(p.unallocated)}</td>
              <td className="px-5 py-3.5 text-slate-500">{formatDate(p.paymentDate)}</td>
              <td className="px-5 py-3.5">
                <Badge tone={STATUS_TONES[p.status] ?? "slate"}>{p.status}</Badge>
              </td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 && !loading && (
          <p className="px-5 pb-5 text-sm text-slate-400">No payments found.</p>
        )}
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </Card>

      {open && (
        <RecordInvoicePaymentModal
          onClose={() => setOpen(false)}
          onPaid={(result) => {
            setOpen(false);
            setNotice(
              `Payment recorded for ${result.invoiceNumber}. Invoice is now ${result.status.replaceAll("_", " ")}.`,
            );
            void load();
            void refreshVisits();
          }}
        />
      )}
    </RoleGuard>
  );
}
