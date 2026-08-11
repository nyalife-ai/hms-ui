"use client";

import { Printer, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useHospitalSettings } from "@/lib/hospital";
import { facilityHeaderHtml, printIsolatedDocument } from "@/lib/print-document";

type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  patientName: string;
  patientMrn: string;
  invoiceDate: string;
  dueDate: string | null;
  subtotal: string;
  discount: string;
  tax: string;
  totalAmount: string;
  outstanding: string;
  status: string;
  notes: string | null;
  items: Array<{
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    totalPrice: string;
  }>;
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function InvoicePrintModal({
  invoiceId,
  onClose,
}: {
  invoiceId: string;
  onClose: () => void;
}) {
  const { hospital } = useHospitalSettings();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await api<InvoiceDetail>(`/billing/invoices/${invoiceId}`);
        if (!cancelled) {
          setInvoice(data);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load invoice");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  const handlePrint = () => {
    if (!invoice) return;
    const facility = {
      name: hospital.name,
      address: hospital.address,
      phone: hospital.phone,
      email: hospital.email,
    };

    const rows = invoice.items
      .map(
        (line) => `
      <tr>
        <td>${escapeHtml(line.description)}</td>
        <td class="num">${escapeHtml(formatKes(line.quantity))}</td>
        <td class="num">${escapeHtml(formatKes(line.unitPrice))}</td>
        <td class="num">${escapeHtml(formatKes(line.totalPrice))}</td>
      </tr>`,
      )
      .join("");

    const discountRow =
      Number(invoice.discount) > 0
        ? `<div class="row"><span>Discount</span><span>−${escapeHtml(formatKes(invoice.discount))}</span></div>`
        : "";
    const taxRow =
      Number(invoice.tax) > 0
        ? `<div class="row"><span>Tax</span><span>${escapeHtml(formatKes(invoice.tax))}</span></div>`
        : "";
    const outstandingRow =
      invoice.status !== "DRAFT" && Number(invoice.outstanding) > 0
        ? `<div class="row muted"><span>Outstanding</span><span>KES ${escapeHtml(formatKes(invoice.outstanding))}</span></div>`
        : "";

    printIsolatedDocument({
      title: `Invoice ${invoice.invoiceNumber}`,
      facility,
      bodyHtml: `
        ${facilityHeaderHtml(facility)}
        <p class="doc-title">Outpatient invoice</p>
        <div class="grid">
          <div>
            <div class="label">Invoice</div>
            <div class="value">${escapeHtml(invoice.invoiceNumber)}</div>
          </div>
          <div>
            <div class="label">Status</div>
            <div class="value">${escapeHtml(invoice.status.replaceAll("_", " "))}</div>
          </div>
          <div>
            <div class="label">Patient</div>
            <div class="value">${escapeHtml(invoice.patientName)}</div>
            <div class="muted">${escapeHtml(invoice.patientMrn)}</div>
          </div>
          <div>
            <div class="label">Date</div>
            <div class="value">${escapeHtml(formatDate(invoice.invoiceDate))}</div>
            <div class="muted">Due ${escapeHtml(formatDate(invoice.dueDate))}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="num">Qty</th>
              <th class="num">Unit</th>
              <th class="num">Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="totals">
          <div class="row"><span>Subtotal</span><span>${escapeHtml(formatKes(invoice.subtotal))}</span></div>
          ${discountRow}
          ${taxRow}
          <div class="row grand"><span>Total</span><span>KES ${escapeHtml(formatKes(invoice.totalAmount))}</span></div>
          ${outstandingRow}
        </div>
        <div class="footer">Thank you for choosing ${escapeHtml(facility.name)}.</div>
      `,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Invoice</h3>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!invoice}
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-300 disabled:opacity-40"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button type="button" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>

        {loading && <p className="text-sm text-slate-400">Loading invoice…</p>}
        {error && <p className="text-sm text-rose-500">{error}</p>}

        {invoice && (
          <div className="space-y-4 text-sm text-slate-700">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-transparent.png"
                alt=""
                className="h-14 w-14 object-contain"
              />
              <div>
                <p className="text-lg font-bold text-slate-900">{hospital.name}</p>
                <p className="text-xs text-slate-400">Outpatient invoice</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-slate-400">Invoice</p>
                <p className="font-semibold">{invoice.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Status</p>
                <p className="font-semibold">{invoice.status.replaceAll("_", " ")}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Patient</p>
                <p className="font-semibold">{invoice.patientName}</p>
                <p className="text-xs text-slate-400">{invoice.patientMrn}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Date</p>
                <p className="font-semibold">{formatDate(invoice.invoiceDate)}</p>
                <p className="text-xs text-slate-400">Due {formatDate(invoice.dueDate)}</p>
              </div>
            </div>

            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] text-slate-400">
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 font-medium">Qty</th>
                  <th className="pb-2 font-medium">Unit</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((line) => (
                  <tr key={line.id} className="border-b border-slate-50">
                    <td className="py-2">{line.description}</td>
                    <td className="py-2">{formatKes(line.quantity)}</td>
                    <td className="py-2">{formatKes(line.unitPrice)}</td>
                    <td className="py-2 text-right font-medium">
                      {formatKes(line.totalPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-1 border-t border-slate-100 pt-3 text-right">
              <p>
                Subtotal: <span className="font-medium">{formatKes(invoice.subtotal)}</span>
              </p>
              {Number(invoice.discount) > 0 && (
                <p>
                  Discount:{" "}
                  <span className="font-medium">−{formatKes(invoice.discount)}</span>
                </p>
              )}
              {Number(invoice.tax) > 0 && (
                <p>
                  Tax: <span className="font-medium">{formatKes(invoice.tax)}</span>
                </p>
              )}
              <p className="text-base font-bold text-slate-900">
                Total: KES {formatKes(invoice.totalAmount)}
              </p>
              {invoice.status !== "DRAFT" && Number(invoice.outstanding) > 0 && (
                <p className="text-xs text-amber-700">
                  Outstanding: KES {formatKes(invoice.outstanding)}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
