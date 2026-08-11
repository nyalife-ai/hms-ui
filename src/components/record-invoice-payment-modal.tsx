"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FieldLabel } from "@/components/field-label";
import {
  InvoiceSearchSelect,
  type InvoiceHit,
} from "@/components/invoice-search-select";
import { PrimaryButton } from "@/components/ui";
import { api } from "@/lib/api";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type PaymentMethod = {
  id: string;
  methodName: string;
  methodCode: string;
  isActive: boolean;
};

type Props = {
  /** Pre-select an invoice (from the invoices table action). */
  initialInvoice?: InvoiceHit | null;
  onClose: () => void;
  onPaid: (result: {
    invoiceId: string;
    invoiceNumber: string;
    paymentId: string;
    status: string;
  }) => void;
};

function amountDue(inv: InvoiceHit): number {
  if (inv.status === "DRAFT") return Number(inv.totalAmount) || 0;
  return Number(inv.outstanding || inv.totalAmount) || 0;
}

/**
 * Record payment against an invoice — issues draft if needed, applies optional
 * discount, creates payment + allocation + journals via /billing/invoices/:id/collect.
 */
export function RecordInvoicePaymentModal({
  initialInvoice,
  onClose,
  onPaid,
}: Props) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [invoiceId, setInvoiceId] = useState(initialInvoice?.id ?? "");
  const [invoice, setInvoice] = useState<InvoiceHit | null>(initialInvoice ?? null);
  const [methodId, setMethodId] = useState("");
  const [discount, setDiscount] = useState("");
  const [amount, setAmount] = useState(
    initialInvoice ? String(amountDue(initialInvoice)) : "",
  );
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const list = await api<PaymentMethod[]>("/billing/payment-methods?active=true");
        setMethods(Array.isArray(list) ? list : []);
        const cash = (Array.isArray(list) ? list : []).find((m) => m.methodCode === "CASH");
        if (cash) setMethodId(cash.id);
      } catch {
        // form still usable once methods load fails — user sees empty select
      }
    })();
  }, []);

  const selectInvoice = (id: string, inv?: InvoiceHit) => {
    setInvoiceId(id);
    setInvoice(inv ?? null);
    if (inv) {
      setAmount(String(amountDue(inv)));
      setDiscount(inv.status === "DRAFT" && Number(inv.discount) > 0 ? inv.discount : "");
    } else {
      setAmount("");
      setDiscount("");
    }
  };

  const discountNum = Number(discount) || 0;
  const previewTotal =
    invoice?.status === "DRAFT" && discountNum > 0
      ? Math.max(0, (Number(invoice.totalAmount) || 0) + (Number(invoice.discount) || 0) - discountNum)
      : amountDue(invoice ?? { outstanding: amount, totalAmount: amount, status: "ISSUED" } as InvoiceHit);

  const submit = async () => {
    if (!invoiceId) {
      setError("Select an invoice to pay.");
      return;
    }
    if (!methodId) {
      setError("Select a payment method (Cash or M-Pesa).");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<{
        invoiceId: string;
        invoiceNumber: string;
        paymentId: string;
        status: string;
      }>(`/billing/invoices/${invoiceId}/collect`, {
        method: "POST",
        body: JSON.stringify({
          paymentMethodId: methodId,
          amount: amt,
          discount:
            invoice?.status === "DRAFT" && discount !== ""
              ? Number(discount)
              : undefined,
          transactionReference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      onPaid(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record payment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Record payment</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Payment is allocated to the selected invoice. Drafts are issued first; journals and
          ledger accounts update automatically.
        </p>

        {!initialInvoice && (
          <div>
            <FieldLabel required>Invoice</FieldLabel>
            <InvoiceSearchSelect value={invoiceId} onChange={selectInvoice} />
          </div>
        )}

        {invoice && (
          <div className="rounded-xl bg-[#f3f7f7] px-3.5 py-3 text-sm">
            <p className="font-semibold text-slate-800">{invoice.invoiceNumber}</p>
            <p className="text-[11px] text-slate-500">
              {invoice.patientName} · {invoice.patientMrn} · {invoice.status.replaceAll("_", " ")}
            </p>
            <p className="mt-1 text-slate-700">
              {invoice.status === "DRAFT" ? "Draft total" : "Outstanding"}:{" "}
              <span className="font-semibold">
                KES {amountDue(invoice).toLocaleString()}
              </span>
            </p>
          </div>
        )}

        {invoice?.status === "DRAFT" && (
          <div>
            <FieldLabel optional>Discount (KES)</FieldLabel>
            <input
              className={inputClass}
              type="number"
              min={0}
              step="0.01"
              value={discount}
              onChange={(e) => {
                setDiscount(e.target.value);
                const d = Number(e.target.value) || 0;
                const base =
                  (Number(invoice.totalAmount) || 0) + (Number(invoice.discount) || 0);
                setAmount(String(Math.max(0, base - d)));
              }}
              placeholder="0"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Applied before issue. Pay amount preview ≈ KES{" "}
              {Number.isFinite(previewTotal) ? previewTotal.toLocaleString() : "—"}
            </p>
          </div>
        )}

        <div>
          <FieldLabel required>Method</FieldLabel>
          <select
            className={inputClass}
            value={methodId}
            onChange={(e) => setMethodId(e.target.value)}
          >
            <option value="">Select method…</option>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.methodName} ({m.methodCode})
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel required>Amount paid (KES)</FieldLabel>
          <input
            className={inputClass}
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div>
          <FieldLabel optional>Reference (e.g. M-Pesa receipt)</FieldLabel>
          <input
            className={inputClass}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>

        <div>
          <FieldLabel optional>Notes</FieldLabel>
          <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && <p className="text-[11px] font-medium text-rose-500">{error}</p>}

        <PrimaryButton disabled={busy} onClick={() => void submit()}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            "Record payment"
          )}
        </PrimaryButton>
      </div>
    </div>
  );
}
