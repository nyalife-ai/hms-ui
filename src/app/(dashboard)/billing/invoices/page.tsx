"use client";

import { Ban, CheckCircle2, FileText, Plus, Printer, Wallet, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FieldLabel } from "@/components/field-label";
import { InvoicePrintModal } from "@/components/invoice-print-modal";
import { PaginationBar } from "@/components/pagination-bar";
import { PatientSearchSelect } from "@/components/patient-search-select";
import { RecordInvoicePaymentModal } from "@/components/record-invoice-payment-modal";
import { RoleGuard } from "@/components/role-guard";
import { TableAction } from "@/components/table-action";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  PageHeader,
  PrimaryButton,
  StatCard,
  Table,
  type BadgeTone,
} from "@/components/ui";
import { api } from "@/lib/api";
import { buildListQuery, toPageMeta, unwrapPage } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useVisits } from "@/lib/visits";
import type { InvoiceHit } from "@/components/invoice-search-select";

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type InvoiceRow = InvoiceHit & {
  invoiceDate: string;
  dueDate: string | null;
};

type ServiceOpt = {
  id: string;
  serviceCode: string;
  serviceName: string;
  standardPrice: string;
  isActive: boolean;
};

const STATUS_TONES: Record<string, BadgeTone> = {
  DRAFT: "slate",
  ISSUED: "blue",
  PARTIALLY_PAID: "amber",
  PAID: "green",
  VOIDED: "red",
};

function formatKes(v: string | number) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v);
}

function formatDate(v: string | null | undefined) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString();
  } catch {
    return String(v);
  }
}

export default function BillingInvoicesPage() {
  const { refresh: refreshVisits } = useVisits();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [patientId, setPatientId] = useState("");
  const [services, setServices] = useState<ServiceOpt[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [qty, setQty] = useState("1");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [payInvoice, setPayInvoice] = useState<InvoiceHit | null>(null);
  const [printInvoiceId, setPrintInvoiceId] = useState("");
  const [kpi, setKpi] = useState<{
    total: number;
    draft: number;
    issued: number;
    partiallyPaid: number;
    paid: number;
    outstandingKes: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildListQuery({
        page,
        limit: 50,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      const [res, summary] = await Promise.all([
        unwrapPage<InvoiceRow>(await api(`/billing/invoices?${qs}`)),
        api<{
          total: number;
          draft: number;
          issued: number;
          partiallyPaid: number;
          paid: number;
          outstandingKes: string;
        }>("/billing/invoices/summary").catch(() => null),
      ]);
      setRows(res.items);
      setTotal(res.total);
      setLimit(res.limit);
      if (summary) setKpi(summary);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load invoices");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = async () => {
    setFormError("");
    setPatientId("");
    setServiceId("");
    setQty("1");
    setDiscount("");
    setNotes("");
    setOpen(true);
    try {
      const qs = buildListQuery({ page: 1, limit: 50, active: true });
      const res = unwrapPage<ServiceOpt>(await api(`/billing/services?${qs}`));
      setServices(res.items.filter((s) => s.isActive));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to load services");
    }
  };

  const create = async () => {
    if (!patientId) {
      setFormError("Select a patient.");
      return;
    }
    if (!serviceId) {
      setFormError("Select a service.");
      return;
    }
    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFormError("Enter a valid quantity.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await api("/billing/invoices", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          notes: notes || undefined,
          discount: discount !== "" ? Number(discount) : undefined,
          lines: [{ serviceId, quantity }],
        }),
      });
      setOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create invoice");
    } finally {
      setBusy(false);
    }
  };

  const issue = async (id: string) => {
    setActionBusy(id);
    try {
      await api(`/billing/invoices/${id}/issue`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not issue invoice");
    } finally {
      setActionBusy("");
    }
  };

  const voidInvoice = async (id: string) => {
    const reason = window.prompt("Reason for voiding this invoice?");
    if (!reason?.trim()) return;
    setActionBusy(id);
    try {
      await api(`/billing/invoices/${id}/void`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not void invoice");
    } finally {
      setActionBusy("");
    }
  };

  const meta = toPageMeta({ total, page, limit });

  return (
    <RoleGuard module="billing">
      <PageHeader
        title="Invoices"
        subtitle={loading ? "Loading…" : `${total.toLocaleString()} invoices`}
        action={
          <PrimaryButton onClick={() => void openCreate()}>
            <Plus className="h-4 w-4" /> Create draft
          </PrimaryButton>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}
      {notice && (
        <p className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">{notice}</p>
      )}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Draft"
          value={kpi ? String(kpi.draft) : "…"}
          deltaLabel="not yet issued"
          icon={FileText}
        />
        <StatCard
          label="Issued"
          value={kpi ? String(kpi.issued) : "…"}
          deltaLabel="awaiting payment"
          icon={Wallet}
        />
        <StatCard
          label="Partially paid"
          value={kpi ? String(kpi.partiallyPaid) : "…"}
          deltaLabel="open balance"
          icon={Printer}
        />
        <StatCard
          label="Outstanding"
          value={kpi ? formatKes(kpi.outstandingKes) : "…"}
          deltaLabel="KES on issued invoices"
          icon={CheckCircle2}
        />
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className={`min-w-[220px] flex-1 ${inputClass}`}
          placeholder="Search invoice # or patient…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={`w-44 ${inputClass}`}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "VOIDED"].map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <Card>
        <CardHeader title="Invoice register" subtitle={`${total.toLocaleString()} records`} />
        <Table
          headers={["Invoice", "Patient", "Date", "Total", "Outstanding", "Status", ""]}
        >
          {rows.map((inv) => (
            <tr key={inv.id} className="hover:bg-surface-200/60">
              <td className="px-5 py-3.5 font-semibold text-foreground">{inv.invoiceNumber}</td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={inv.patientName} size="sm" />
                  <div>
                    <p className="text-sm text-foreground">{inv.patientName}</p>
                    <p className="text-[11px] text-foreground-lighter">{inv.patientMrn}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3.5 text-foreground-light">{formatDate(inv.invoiceDate)}</td>
              <td className="px-5 py-3.5 text-foreground-light">{formatKes(inv.totalAmount)}</td>
              <td className="px-5 py-3.5 text-foreground-light">
                {inv.status === "DRAFT" ? formatKes(inv.totalAmount) : formatKes(inv.outstanding)}
              </td>
              <td className="px-5 py-3.5">
                <Badge tone={STATUS_TONES[inv.status] ?? "slate"}>
                  {inv.status.replaceAll("_", " ")}
                </Badge>
              </td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-1">
                  <TableAction
                    icon={Printer}
                    label="Print invoice"
                    tone="neutral"
                    onClick={() => setPrintInvoiceId(inv.id)}
                  />
                  {["DRAFT", "ISSUED", "PARTIALLY_PAID"].includes(inv.status) && (
                    <TableAction
                      icon={Wallet}
                      label="Record payment"
                      tone="add"
                      loading={actionBusy === `pay-${inv.id}`}
                      disabled={Boolean(actionBusy)}
                      onClick={() => {
                        setNotice("");
                        setPayInvoice(inv);
                      }}
                    />
                  )}
                  {inv.status === "DRAFT" && (
                    <TableAction
                      icon={CheckCircle2}
                      label="Issue invoice"
                      tone="neutral"
                      loading={actionBusy === inv.id}
                      disabled={actionBusy === inv.id}
                      onClick={() => void issue(inv.id)}
                    />
                  )}
                  {inv.status !== "VOIDED" && inv.status !== "PAID" && (
                    <TableAction
                      icon={Ban}
                      label="Void invoice"
                      tone="danger"
                      loading={actionBusy === inv.id}
                      disabled={actionBusy === inv.id}
                      onClick={() => void voidInvoice(inv.id)}
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 && !loading && (
          <p className="px-5 pb-5 text-sm text-foreground-lighter">No invoices found.</p>
        )}
        <PaginationBar meta={meta} onPageChange={setPage} disabled={loading} />
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Create draft invoice</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-4 w-4 text-foreground-lighter" />
              </button>
            </div>
            <div>
              <FieldLabel required>Patient</FieldLabel>
              <PatientSearchSelect value={patientId} onChange={(id) => setPatientId(id)} />
            </div>
            <div>
              <FieldLabel required>Service</FieldLabel>
              <select
                className={inputClass}
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
              >
                <option value="">Select service…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.serviceCode} · {s.serviceName} (KES {formatKes(s.standardPrice)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel required>Quantity</FieldLabel>
              <input
                className={inputClass}
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel optional>Discount (KES)</FieldLabel>
              <input
                className={inputClass}
                type="number"
                min={0}
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <FieldLabel optional>Notes</FieldLabel>
              <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {formError && <p className="text-[11px] font-medium text-rose-500">{formError}</p>}
            <PrimaryButton disabled={busy} onClick={create}>
              {busy ? "Saving…" : "Create draft"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {payInvoice && (
        <RecordInvoicePaymentModal
          initialInvoice={payInvoice}
          onClose={() => setPayInvoice(null)}
          onPaid={(result) => {
            setPayInvoice(null);
            setNotice(
              `Payment recorded for ${result.invoiceNumber}. Status: ${result.status.replaceAll("_", " ")}.`,
            );
            void load();
            void refreshVisits();
          }}
        />
      )}

      {printInvoiceId && (
        <InvoicePrintModal
          invoiceId={printInvoiceId}
          onClose={() => setPrintInvoiceId("")}
        />
      )}
    </RoleGuard>
  );
}
