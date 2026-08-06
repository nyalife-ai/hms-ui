"use client";

import { Printer, X } from "lucide-react";

export type ReceiptData = {
  id: string;
  receiptNumber: string;
  channel: string;
  amount: number;
  issuedAt: string;
  lineItems: { description: string; amount: number }[];
  meta?: Record<string, unknown>;
  patient: { mrn?: string; name: string; phone?: string };
  facility: { name: string; location: string };
};

export function ReceiptModal({
  receipt,
  onClose,
}: {
  receipt: ReceiptData;
  onClose: () => void;
}) {
  const print = () => window.print();
  const mpesaRef = receipt.meta?.mpesaReceipt
    ? String(receipt.meta.mpesaReceipt)
    : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 print:static print:bg-white">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl print:shadow-none print:max-w-none">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <h3 className="text-base font-semibold text-slate-800">Payment receipt</h3>
          <div className="flex gap-2">
            <button
              onClick={print}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-300"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div id="nyalife-receipt" className="space-y-4 text-slate-800">
          <div className="border-b border-dashed border-slate-200 pb-3 text-center">
            <p className="text-lg font-bold tracking-tight">{receipt.facility.name}</p>
            <p className="text-xs text-slate-500">{receipt.facility.location}</p>
            <p className="mt-2 text-sm font-semibold">{receipt.receiptNumber}</p>
            <p className="text-[11px] text-slate-400">
              {new Date(receipt.issuedAt).toLocaleString()}
            </p>
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
          </ul>

          <div className="flex items-center justify-between text-base font-bold">
            <span>Total</span>
            <span>KES {receipt.amount.toLocaleString()}</span>
          </div>

          <div className="rounded-xl bg-[#f3f7f7] px-3 py-2.5 text-xs text-slate-600">
            <p>
              Paid via <span className="font-semibold">{receipt.channel}</span>
              {mpesaRef ? ` · Ref ${mpesaRef}` : ""}
            </p>
            <p className="mt-1 text-slate-400">Thank you for choosing {receipt.facility.name}.</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 print:hidden"
        >
          Done
        </button>
      </div>
    </div>
  );
}
