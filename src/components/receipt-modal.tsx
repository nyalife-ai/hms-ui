"use client";

import { Printer, X } from "lucide-react";
import { useHospitalSettings } from "@/lib/hospital";
import { facilityHeaderHtml, printIsolatedDocument } from "@/lib/print-document";

export type ReceiptData = {
  id: string;
  receiptNumber: string;
  channel: string;
  amount: number;
  issuedAt: string;
  lineItems: { description: string; amount: number }[];
  meta?: Record<string, unknown>;
  paymentContext?: {
    invoiceNumber?: string;
    invoiceTotal?: number;
    previousPaid?: number;
    currentPayment?: number;
    balance?: number;
    totalPaid?: number;
  };
  patient: { mrn?: string; name: string; phone?: string };
  facility: { name: string; location: string };
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number | undefined): string {
  return Number(n ?? 0).toLocaleString();
}

export function ReceiptModal({
  receipt,
  onClose,
}: {
  receipt: ReceiptData;
  onClose: () => void;
}) {
  const { hospital } = useHospitalSettings();
  const mpesaRef = receipt.meta?.mpesaReceipt
    ? String(receipt.meta.mpesaReceipt)
    : undefined;

  const facilityName = hospital.name || receipt.facility.name;
  const facilityBits = [
    hospital.address || receipt.facility.location,
    hospital.phone,
    hospital.email,
  ]
    .map((v) => v?.trim())
    .filter(Boolean) as string[];

  const ctx = receipt.paymentContext ?? {
    invoiceNumber: receipt.meta?.invoiceNumber
      ? String(receipt.meta.invoiceNumber)
      : undefined,
    invoiceTotal: Number(receipt.meta?.invoiceTotal ?? NaN),
    previousPaid: Number(receipt.meta?.previousPaid ?? NaN),
    currentPayment: Number(receipt.meta?.currentPayment ?? receipt.amount),
    balance: Number(receipt.meta?.balance ?? NaN),
    totalPaid: Number(
      receipt.meta?.totalPaid ??
        (Number(receipt.meta?.previousPaid ?? 0) +
          Number(receipt.meta?.currentPayment ?? receipt.amount)),
    ),
  };

  const taxAmount = Number(receipt.meta?.tax ?? NaN);
  const subtotalAmount = Number(receipt.meta?.subtotal ?? NaN);
  const taxRateLabel = receipt.meta?.taxRatePercentage
    ? String(receipt.meta.taxRatePercentage)
    : null;

  const showTaxBreakdown =
    Number.isFinite(taxAmount) && taxAmount > 0;

  const showContext =
    Number.isFinite(ctx.invoiceTotal) ||
    Number.isFinite(ctx.previousPaid) ||
    Number.isFinite(ctx.balance);

  const handlePrint = () => {
    const facility = {
      name: facilityName,
      address: hospital.address || receipt.facility.location,
      phone: hospital.phone,
      email: hospital.email,
    };

    const lines = receipt.lineItems
      .map(
        (line) => `
      <tr>
        <td>${escapeHtml(line.description)}</td>
        <td class="num">KES ${escapeHtml(line.amount.toLocaleString())}</td>
      </tr>`,
      )
      .join("");

    const contextRows = showContext
      ? `
        <div class="totals">
          ${
            Number.isFinite(ctx.invoiceTotal)
              ? `<div class="row"><span>Invoice total${
                  ctx.invoiceNumber ? ` (${escapeHtml(ctx.invoiceNumber)})` : ""
                }</span><span>KES ${escapeHtml(money(ctx.invoiceTotal))}</span></div>`
              : ""
          }
          ${
            Number.isFinite(ctx.previousPaid) && (ctx.previousPaid ?? 0) > 0
              ? `<div class="row"><span>Previous payments</span><span>KES ${escapeHtml(
                  money(ctx.previousPaid),
                )}</span></div>`
              : ""
          }
          <div class="row"><span>This payment</span><span>KES ${escapeHtml(
            money(ctx.currentPayment ?? receipt.amount),
          )}</span></div>
          ${
            Number.isFinite(ctx.balance)
              ? `<div class="row"><span>Balance</span><span>KES ${escapeHtml(
                  money(ctx.balance),
                )}</span></div>`
              : ""
          }
          <div class="row grand"><span>Receipt total</span><span>KES ${escapeHtml(
            receipt.amount.toLocaleString(),
          )}</span></div>
        </div>`
      : `<div class="totals">
          <div class="row grand"><span>Total</span><span>KES ${escapeHtml(
            receipt.amount.toLocaleString(),
          )}</span></div>
        </div>`;

    printIsolatedDocument({
      title: `Receipt ${receipt.receiptNumber}`,
      facility,
      bodyHtml: `
        ${facilityHeaderHtml(facility)}
        <p class="doc-title">Payment receipt</p>
        <div class="grid">
          <div>
            <div class="label">Receipt</div>
            <div class="value">${escapeHtml(receipt.receiptNumber)}</div>
          </div>
          <div>
            <div class="label">Issued</div>
            <div class="value">${escapeHtml(new Date(receipt.issuedAt).toLocaleString())}</div>
          </div>
          <div>
            <div class="label">Patient</div>
            <div class="value">${escapeHtml(receipt.patient.name)}</div>
            <div class="muted">${escapeHtml(
              [receipt.patient.mrn, receipt.patient.phone].filter(Boolean).join(" · "),
            )}</div>
          </div>
          <div>
            <div class="label">Paid via</div>
            <div class="value">${escapeHtml(receipt.channel)}${
              mpesaRef ? ` · Ref ${escapeHtml(mpesaRef)}` : ""
            }</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="num">Amount</th>
            </tr>
          </thead>
          <tbody>${lines}</tbody>
        </table>
        ${contextRows}
        <div class="footer">Thank you for choosing ${escapeHtml(facility.name)}.</div>
      `,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Payment receipt</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-300"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4 text-slate-800">
          <div className="flex items-center gap-3 border-b border-dashed border-slate-200 pb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-transparent.png"
              alt=""
              className="h-14 w-14 object-contain"
            />
            <div>
              <p className="text-lg font-bold tracking-tight">{facilityName}</p>
              {facilityBits.length > 0 && (
                <p className="text-xs text-slate-500">{facilityBits.join(" · ")}</p>
              )}
              <p className="mt-1 text-sm font-semibold">{receipt.receiptNumber}</p>
              <p className="text-[11px] text-slate-400">
                {new Date(receipt.issuedAt).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="text-sm">
            <p>
              <span className="text-slate-400">Patient</span>{" "}
              <span className="font-semibold">{receipt.patient.name}</span>
            </p>
            <p className="text-xs text-slate-500">
              {receipt.patient.mrn}
              {receipt.patient.phone ? ` · ${receipt.patient.phone}` : ""}
            </p>
          </div>

          <ul className="space-y-1.5 border-y border-dashed border-slate-200 py-3 text-sm">
            {receipt.lineItems.map((line, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-slate-600">{line.description}</span>
                <span className="font-medium">KES {line.amount.toLocaleString()}</span>
              </li>
            ))}
            {showTaxBreakdown && (
              <>
                {Number.isFinite(subtotalAmount) && (
                  <li className="flex justify-between gap-3 text-slate-500">
                    <span>Subtotal</span>
                    <span>KES {money(subtotalAmount)}</span>
                  </li>
                )}
                <li className="flex justify-between gap-3 text-slate-500">
                  <span>Tax{taxRateLabel ? ` (${taxRateLabel}%)` : ""}</span>
                  <span>KES {money(taxAmount)}</span>
                </li>
              </>
            )}
          </ul>

          {showContext ? (
            <div className="space-y-1 text-sm">
              {Number.isFinite(ctx.invoiceTotal) && (
                <div className="flex justify-between text-slate-500">
                  <span>
                    Invoice total
                    {ctx.invoiceNumber ? ` (${ctx.invoiceNumber})` : ""}
                  </span>
                  <span>KES {money(ctx.invoiceTotal)}</span>
                </div>
              )}
              {Number.isFinite(ctx.previousPaid) && (ctx.previousPaid ?? 0) > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Previous payments</span>
                  <span>KES {money(ctx.previousPaid)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>This payment</span>
                <span>KES {money(ctx.currentPayment ?? receipt.amount)}</span>
              </div>
              {Number.isFinite(ctx.balance) && (
                <div className="flex justify-between text-slate-500">
                  <span>Balance</span>
                  <span>KES {money(ctx.balance)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-2 text-base font-bold">
                <span>Receipt total</span>
                <span>KES {receipt.amount.toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-base font-bold">
              <span>Total</span>
              <span>KES {receipt.amount.toLocaleString()}</span>
            </div>
          )}

          <div className="rounded-xl bg-[#f3f7f7] px-3 py-2.5 text-xs text-slate-600">
            <p>
              Paid via <span className="font-semibold">{receipt.channel}</span>
              {mpesaRef ? ` · Ref ${mpesaRef}` : ""}
            </p>
            <p className="mt-1 text-slate-400">Thank you for choosing {facilityName}.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Done
        </button>
      </div>
    </div>
  );
}
