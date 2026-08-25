"use client";

import { CheckCircle2, Loader2, Smartphone, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ReceiptModal, type ReceiptData } from "@/components/receipt-modal";

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

/** Poll cadence (ms) — backs off; stops on terminal status. */
const POLL_DELAYS_MS = [0, 2000, 3000, 5000, 5000, 8000, 10000, 15000, 15000, 20000];

type UiPhase =
  | "IDLE"
  | "PROCESSING"
  | "QUEUED"
  | "SENDING_STK"
  | "WAITING_CUSTOMER"
  | "SUCCESS"
  | "FAILED"
  | "TIMEOUT";

type StatusPayload = {
  status: string;
  stage?: string;
  paid?: boolean;
  receiptId?: string;
  message?: string;
  failureReason?: string;
  mode?: string;
  checkoutId?: string;
  paymentId?: string;
  correlationId?: string;
  /** Prefer public timeline (label). Legacy stage codes still accepted. */
  timeline?: Array<{
    label?: string;
    stage?: string;
    at: string;
    message?: string;
  }>;
};

type Props = {
  visitId: string;
  patientName: string;
  defaultPhone?: string;
  amount: number;
  source: "RECEPTION" | "PHARMACY";
  onClose: () => void;
  onPaid: () => void;
};

function mapPhase(status: string, stage?: string): UiPhase {
  if (status === "SUCCESS") return "SUCCESS";
  if (status === "TIMEOUT") return "TIMEOUT";
  if (status === "FAILED" || status === "CANCELLED") return "FAILED";
  if (status === "QUEUED") return "QUEUED";
  if (status === "PROCESSING") {
    if (
      stage === "DARAJA_REQUEST_STARTED" ||
      stage === "DARAJA_RESPONSE_RECEIVED" ||
      stage === "STK_SENT"
    ) {
      return "SENDING_STK";
    }
    return "PROCESSING";
  }
  if (status === "PENDING" || status === "FINALIZING") return "WAITING_CUSTOMER";
  return "PROCESSING";
}

function phaseCopy(phase: UiPhase): { title: string; hint: string } {
  switch (phase) {
    case "PROCESSING":
      return {
        title: "Preparing payment…",
        hint: "Setting up the M-Pesa request for this bill.",
      };
    case "QUEUED":
      return {
        title: "Preparing payment…",
        hint: "Almost ready — connecting to M-Pesa.",
      };
    case "SENDING_STK":
      return {
        title: "Sending phone prompt…",
        hint: "The patient should receive an M-Pesa prompt shortly.",
      };
    case "WAITING_CUSTOMER":
      return {
        title: "Waiting for PIN",
        hint: "Ask the patient to enter their M-Pesa PIN on their phone.",
      };
    case "SUCCESS":
      return { title: "Payment successful", hint: "Receipt is ready." };
    case "TIMEOUT":
      return {
        title: "No PIN entered in time",
        hint: "You can send the payment request again.",
      };
    case "FAILED":
      return {
        title: "Payment not completed",
        hint: "See the reason below, then try again if needed.",
      };
    default:
      return { title: "M-Pesa payment", hint: "" };
  }
}

function timelineLabel(ev: {
  label?: string;
  stage?: string;
  message?: string;
}): string {
  if (ev.label?.trim()) return ev.label;
  // Fallback if an older API still returns stage codes
  const stage = ev.stage || "";
  const map: Record<string, string> = {
    INITIATED: "Preparing payment",
    QUEUED: "Preparing payment",
    JOB_CREATED: "Preparing payment",
    JOB_PICKED_UP: "Connecting to M-Pesa",
    PROCESSING: "Connecting to M-Pesa",
    DARAJA_REQUEST_STARTED: "Sending phone prompt",
    DARAJA_RESPONSE_RECEIVED: "Sending phone prompt",
    STK_SENT: "Waiting for PIN",
    WAITING_CALLBACK: "Waiting for PIN",
    CALLBACK_RECEIVED: "Confirming payment",
    FINALIZING: "Confirming payment",
    SUCCESS: "Payment successful",
    FAILED: "Payment failed",
    CANCELLED: "Payment cancelled",
    TIMEOUT: "Payment timed out",
  };
  return map[stage] || ev.message || "Updating payment";
}

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
  const [phase, setPhase] = useState<UiPhase>("IDLE");
  const [hint, setHint] = useState("");
  const [timeline, setTimeline] = useState<StatusPayload["timeline"]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const pollGen = useRef(0);

  const stopPolling = useCallback(() => {
    pollGen.current += 1;
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const pollStatus = useCallback(
    async (id: string, generation: number) => {
      for (let i = 0; i < POLL_DELAYS_MS.length; i++) {
        if (generation !== pollGen.current) return;
        const delay = POLL_DELAYS_MS[i]!;
        if (delay > 0) {
          await new Promise((r) => setTimeout(r, delay));
        }
        if (generation !== pollGen.current) return;
        try {
          const data = await api<StatusPayload>(`/billing/checkout/${id}/status`);
          if (generation !== pollGen.current) return;
          const next = mapPhase(data.status, data.stage);
          setPhase(next);
          setHint(data.message || phaseCopy(next).hint);
          setTimeline(data.timeline || []);
          if (data.status === "SUCCESS" && data.receiptId) {
            setPhase("SUCCESS");
            const r = await api<ReceiptData>(`/billing/receipts/${data.receiptId}`);
            setReceipt(r);
            onPaid();
            return;
          }
          if (
            data.status === "FAILED" ||
            data.status === "CANCELLED" ||
            data.status === "TIMEOUT"
          ) {
            setPhase(data.status === "TIMEOUT" ? "TIMEOUT" : "FAILED");
            setError(
              data.failureReason ||
                data.message ||
                "Payment was not completed. Please try again.",
            );
            return;
          }
        } catch {
          // keep polling through transient errors
        }
      }
      if (generation !== pollGen.current) return;
      setPhase("TIMEOUT");
      setError(
        "Still waiting for M-Pesa. You can close this and check billing, or send the request again.",
      );
    },
    [onPaid],
  );

  const start = async () => {
    if (!phone.trim()) {
      setError("Enter the patient's M-Pesa phone number.");
      return;
    }
    setBusy(true);
    setError("");
    setPhase("PROCESSING");
    setHint(phaseCopy("PROCESSING").hint);
    setTimeline([]);
    try {
      const data = await api<{
        ok: boolean;
        checkoutId: string;
        paymentId?: string;
        status?: string;
        stage?: string;
        message?: string;
        mode?: string;
        queued?: boolean;
        paid?: boolean;
      }>("/billing/checkout/stk", {
        method: "POST",
        body: JSON.stringify({ visitId, phone, source }),
      });

      if (!data.checkoutId) {
        setPhase("FAILED");
        setError("Could not start M-Pesa payment. Please try again.");
        return;
      }

      setCheckoutId(data.checkoutId);
      const next = mapPhase(data.status || "QUEUED", data.stage);
      setPhase(next);
      setHint(data.message || phaseCopy(next).hint);

      const gen = ++pollGen.current;
      void pollStatus(data.checkoutId, gen);
    } catch (err) {
      setPhase("FAILED");
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

  const copy = phaseCopy(phase);
  const inFlight =
    phase === "PROCESSING" ||
    phase === "QUEUED" ||
    phase === "SENDING_STK" ||
    phase === "WAITING_CUSTOMER";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">M-Pesa payment</h3>
          <button
            onClick={() => {
              stopPolling();
              onClose();
            }}
            className="text-foreground-lighter hover:text-foreground-light"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-foreground-light">
          {patientName} ·{" "}
          <span className="font-semibold text-foreground">KES {amount.toLocaleString()}</span>
        </p>
        <p className="mt-1 text-[11px] text-foreground-lighter">
          {source === "PHARMACY" ? "Pharmacy dispense" : "Outpatient bill"}
        </p>

        {phase === "IDLE" || phase === "FAILED" || phase === "TIMEOUT" ? (
          <div className="mt-4 space-y-3">
            {(phase === "FAILED" || phase === "TIMEOUT") && (
              <div className="rounded-xl bg-rose-50 px-3.5 py-3 text-left">
                <div className="flex items-start gap-2">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-rose-900">{copy.title}</p>
                    <p className="mt-1 text-[12px] text-rose-800/90 whitespace-pre-wrap">
                      {error || hint || copy.hint}
                    </p>
                    <p className="mt-2 text-[11px] text-rose-700/80">
                      Check the phone number, then try again. Or record cash payment instead.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-foreground-light">M-Pesa phone</label>
              <input
                className={`mt-1.5 ${inputClass}`}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XXXXXXXX, 01XXXXXXXX, or 2547XXXXXXXX"
                inputMode="tel"
              />
            </div>
            {phase === "IDLE" && error && (
              <p className="text-[11px] font-medium text-rose-500">{error}</p>
            )}
            <button
              onClick={start}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Smartphone className="h-4 w-4" />
              )}
              {phase === "IDLE" ? "Send M-Pesa payment request" : "Try again"}
            </button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-3 py-4 text-center">
            {phase === "SUCCESS" ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            ) : inFlight ? (
              <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            ) : (
              <XCircle className="h-8 w-8 text-rose-500" />
            )}
            <p className="text-sm font-medium text-foreground">{copy.title}</p>
            <p className="text-[11px] text-foreground-lighter">{hint || copy.hint}</p>
            {timeline && timeline.length > 0 && (
              <button
                type="button"
                className="text-[11px] font-medium text-brand-700 hover:underline"
                onClick={() => setShowDetails((v) => !v)}
              >
                {showDetails ? "Hide progress" : "View progress"}
              </button>
            )}
            {showDetails && timeline && (
              <ol className="mt-1 max-h-40 w-full overflow-y-auto rounded-xl bg-surface-200 px-3 py-2 text-left text-[11px] text-foreground-light">
                {timeline.map((ev, idx) => (
                  <li key={`${ev.at}-${idx}`} className="border-b border-border py-1.5 last:border-0">
                    <span className="font-semibold text-foreground">{timelineLabel(ev)}</span>
                    <span className="text-foreground-lighter">
                      {" "}
                      · {new Date(ev.at).toLocaleTimeString()}
                    </span>
                    {ev.message &&
                    !/job_|daraja|redis|worker|enqueue/i.test(ev.message) ? (
                      <div className="text-foreground-light">{ev.message}</div>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
            {checkoutId && showDetails ? (
              <p className="text-[10px] text-foreground-lighter">Ref {checkoutId.slice(0, 8)}…</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
