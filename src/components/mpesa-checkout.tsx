"use client";

import { Loader2, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ReceiptModal, type ReceiptData } from "@/components/receipt-modal";

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type Props = {
  visitId: string;
  patientName: string;
  defaultPhone?: string;
  amount: number;
  source: "RECEPTION" | "PHARMACY";
  onClose: () => void;
  onPaid: () => void;
};

export function MpesaCheckoutModal({
  visitId,
  patientName,
  defaultPhone = "",
  amount,
  source,
  onClose,
  onPaid,
}: Props) {
  const [phone, setPhone] = useState(defaultPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkoutId, setCheckoutId] = useState("");
  const [status, setStatus] = useState<"IDLE" | "PENDING" | "SUCCESS" | "FAILED">("IDLE");
  const [hint, setHint] = useState("");
  const [mode, setMode] = useState<string>("");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  useEffect(() => {
    if (!checkoutId || status !== "PENDING") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await api<{
          status: string;
          paid?: boolean;
          receiptId?: string;
          message?: string;
        }>(`/billing/checkout/${checkoutId}/status`);
        if (cancelled) return;
        if (data.status === "SUCCESS" && data.receiptId) {
          setStatus("SUCCESS");
          const r = await api<ReceiptData>(`/billing/receipts/${data.receiptId}`);
          setReceipt(r);
          onPaid();
          return;
        }
        if (data.status === "FAILED" || data.status === "CANCELLED") {
          setStatus("FAILED");
          setError(data.message || "Payment was cancelled or failed. Try again.");
        }
      } catch {
        // keep polling
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [checkoutId, status, onPaid]);

  const start = async () => {
    if (!phone.trim()) {
      setError("Enter the patient's M-Pesa phone number.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api<{
        ok: boolean;
        checkoutId: string;
        message?: string;
        mode?: string;
      }>("/billing/checkout/stk", {
        method: "POST",
        body: JSON.stringify({ visitId, phone, source }),
      });
      setCheckoutId(data.checkoutId);
      setMode(data.mode || "");
      setStatus("PENDING");
      setHint(data.message || "Waiting for M-Pesa PIN…");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start M-Pesa payment");
    } finally {
      setBusy(false);
    }
  };

  if (receipt) {
    return (
      <ReceiptModal
        receipt={receipt}
        onClose={() => {
          onClose();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">M-Pesa checkout</h3>
          <button onClick={onClose} className="text-foreground-lighter hover:text-foreground-light">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-foreground-light">
          {patientName} ·{" "}
          <span className="font-semibold text-foreground">KES {amount.toLocaleString()}</span>
        </p>
        <p className="mt-1 text-[11px] text-foreground-lighter">
          {source === "PHARMACY" ? "Pharmacy dispense payment" : "Reception outpatient bill"}
          {mode ? ` · ${mode}` : ""}
        </p>

        {status === "IDLE" || status === "FAILED" ? (
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-foreground-light">M-Pesa phone</label>
              <input
                className={`mt-1.5 ${inputClass}`}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XXXXXXXX or 2547XXXXXXXX"
                inputMode="tel"
              />
            </div>
            {error && <p className="text-[11px] font-medium text-rose-500">{error}</p>}
            <button
              onClick={start}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
              Send M-Pesa payment request
            </button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-3 py-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            <p className="text-sm font-medium text-foreground">Waiting for patient PIN…</p>
            <p className="text-[11px] text-foreground-lighter">{hint}</p>
            {error && <p className="text-[11px] font-medium text-rose-500">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
