"use client";

import Link from "next/link";
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Smartphone,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FieldLabel } from "@/components/field-label";
import { InvoicePrintModal } from "@/components/invoice-print-modal";
import { MpesaCheckoutModal } from "@/components/mpesa-checkout";
import { PatientSearchSelect } from "@/components/patient-search-select";
import { ReceiptModal, type ReceiptData } from "@/components/receipt-modal";
import { RecordInvoicePaymentModal } from "@/components/record-invoice-payment-modal";
import type { InvoiceHit } from "@/components/invoice-search-select";
import { RoleGuard } from "@/components/role-guard";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  PageHeader,
  PrimaryButton,
  StatCard,
  StatCardSkeleton,
  type BadgeTone,
} from "@/components/ui";
import { api } from "@/lib/api";
import { buildListQuery } from "@/lib/pagination";
import { useVisits, type Visit } from "@/lib/visits";

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type BillingOverview = {
  todayIssuedInvoicesTotal: string;
  todayIssuedInvoiceCount: number;
  todayCompletedPaymentsTotal: string;
  outstandingAr: string;
  pendingClaimsCount: number;
};

type VisitQuote = {
  totalAmount: string;
  subtotal: string;
  lines: Array<{ description: string; quantity: number; unitPrice: string; totalPrice: string }>;
};

function formatKes(value: string | number | undefined | null): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString();
}

function quoteKey(visit: Visit): string {
  const lab = visit.labOrder?.tests.length ?? 0;
  const med = visit.prescriptions?.length ?? 0;
  const consult = visit.billing?.consultFeeStatus === "PAID" ? 0 : 1;
  return `${consult}-${lab}-${med}`;
}

function claimItemsFromQuote(quote: VisitQuote | undefined) {
  if (quote?.lines?.length) {
    return quote.lines.map((l) => ({
      description: l.description,
      amount: Number(l.totalPrice) || 0,
    }));
  }
  return [{ description: "Consultation", amount: 0 }];
}

export default function BillingPage() {
  const { visits, finalizeBilling, syncClaim, refresh } = useVisits();
  const billable = visits.filter((v) => v.stage === "READY_FOR_BILLING");
  const awaitingConsultFee = visits.filter((v) => v.stage === "AWAITING_PAYMENT");
  const awaitingInsurer = visits.filter((v) => v.stage === "CLAIM_SUBMITTED");
  const completedToday = visits.filter((v) => v.stage === "COMPLETED");

  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [quotes, setQuotes] = useState<Record<string, VisitQuote>>({});
  const [busyId, setBusyId] = useState("");
  const [checkingId, setCheckingId] = useState("");
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invPatientId, setInvPatientId] = useState("");
  const [invAmount, setInvAmount] = useState("2500");
  const [invDesc, setInvDesc] = useState("Outpatient services");
  const [invBusy, setInvBusy] = useState(false);
  const [invError, setInvError] = useState("");
  const [notice, setNotice] = useState("");
  const [mpesaVisit, setMpesaVisit] = useState<Visit | null>(null);
  const [viewReceipt, setViewReceipt] = useState<ReceiptData | null>(null);
  const [payInvoice, setPayInvoice] = useState<InvoiceHit | null>(null);
  const [cashConfirm, setCashConfirm] = useState<Visit | null>(null);
  const [printInvoiceId, setPrintInvoiceId] = useState("");

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      setOverview(await api<BillingOverview>("/billing/overview"));
      setOverviewError("");
    } catch (err) {
      setOverviewError(err instanceof Error ? err.message : "Unable to load billing overview");
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const quoteKeysNeeded = useMemo(() => {
    const keys = new Set<string>();
    for (const v of [...billable, ...awaitingInsurer]) {
      const key = quoteKey(v);
      const [c, l, m] = key.split("-").map(Number);
      if ((c || 0) + (l || 0) + (m || 0) > 0) keys.add(key);
    }
    return Array.from(keys).sort().join("|");
  }, [billable, awaitingInsurer]);

  useEffect(() => {
    if (!quoteKeysNeeded) return;
    let cancelled = false;
    const keys = quoteKeysNeeded.split("|");
    void (async () => {
      const next: Record<string, VisitQuote> = {};
      await Promise.all(
        keys.map(async (key) => {
          const [consult, lab, med] = key.split("-").map(Number);
          try {
            const qs = buildListQuery({
              consultCount: consult || 1,
              labCount: lab || undefined,
              medCount: med || undefined,
            });
            const quote = await api<VisitQuote>(`/billing/quote/visit?${qs}`);
            next[key] = quote;
          } catch {
            // leave missing; UI falls back to — until retry
          }
        }),
      );
      if (!cancelled) setQuotes((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [quoteKeysNeeded]);

  const visitAmount = (visit: Visit): number => {
    const key = quoteKey(visit);
    const [c, l, m] = key.split("-").map(Number);
    if ((c || 0) + (l || 0) + (m || 0) === 0) {
      return visit.billing?.consultFeeAmount ?? visit.billing?.total ?? 0;
    }
    const q = quotes[key];
    return Number(q?.totalAmount ?? 0) || 0;
  };

  // Auto-poll insurer while claims are pending — signs patient off when accepted
  useEffect(() => {
    if (awaitingInsurer.length === 0) return;
    let cancelled = false;

    const tick = async () => {
      for (const v of awaitingInsurer) {
        if (!v.payment.providerId || v.billing?.claimStatus === "REJECTED") continue;
        try {
          const result = await syncClaim(v.id, v.payment.providerId);
          if (cancelled) return;
          if (result.signedOff) {
            setNotice(`${v.patientName} — insurer accepted claim; patient signed off.`);
            void loadOverview();
          }
        } catch {
          // keep polling; transient switch errors are expected
        }
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll against current awaiting set
  }, [awaitingInsurer.map((v) => v.id).join("|")]);

  const openReceipt = async (receiptId: string) => {
    const r = await api<ReceiptData>(`/billing/receipts/${receiptId}`);
    setViewReceipt(r);
  };

  const settle = async (visit: Visit, channel: "MPESA" | "CASH" = "MPESA") => {
    const total = visitAmount(visit);
    if (visit.payment.method !== "INSURANCE") {
      if (channel === "MPESA") {
        setMpesaVisit(visit);
        return;
      }
      setBusyId(visit.id);
      setNotice("");
      try {
        const settled = await finalizeBilling(visit.id, total);
        setCashConfirm(null);
        setNotice(`${visit.patientName} — cash settlement recorded.`);
        void loadOverview();
        if (settled.billing?.receiptId) {
          try {
            await openReceipt(settled.billing.receiptId);
          } catch {
            // receipt modal optional if fetch fails
          }
        } else if (settled.billing?.invoiceId) {
          setPrintInvoiceId(settled.billing.invoiceId);
        }
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Cash settlement failed.");
      } finally {
        setBusyId("");
      }
      return;
    }
    setBusyId(visit.id);
    setNotice("");
    try {
      const data = await api<{
        ok: boolean;
        claimId?: string;
        error?: string;
        invoiceNumber?: string;
      }>("/insurance/claims", {
        method: "POST",
        body: JSON.stringify({
          providerId: visit.payment.providerId,
          mrn: visit.mrn,
          visitId: visit.id,
          claim: {
            memberNumber: visit.payment.policyNumber,
            patientName: visit.patientName,
            authorizationCode: visit.payment.authorizationCode,
            authToken: visit.payment.authToken,
            ediAuthGuid: visit.payment.ediAuthGuid,
            diagnosis: visit.diagnosis,
            schemeName: visit.payment.schemeName,
            schemeCode: visit.payment.schemeCode,
            benefitType: visit.payment.benefitType,
            visitNumber: visit.mrn,
            visitStart: visit.checkedInAt,
            visitEnd: new Date().toISOString(),
            items: claimItemsFromQuote(quotes[quoteKey(visit)]),
            total,
          },
        }),
      });
      if (!data.ok) {
        window.alert(data.error || "Claim submission failed.");
        return;
      }
      await finalizeBilling(visit.id, total, data.claimId);
      void loadOverview();
      setNotice(
        `${visit.patientName} — claim submitted. Waiting for insurer approval before sign-off.`,
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Claim submission failed.");
    } finally {
      setBusyId("");
    }
  };

  const pollClaim = async (visit: Visit) => {
    if (!visit.payment.providerId) return;
    setCheckingId(visit.id);
    try {
      const result = await syncClaim(visit.id, visit.payment.providerId);
      if (result.signedOff) {
        setNotice(`${visit.patientName} — insurer accepted claim; patient signed off.`);
        void loadOverview();
      } else if (result.status === "REJECTED") {
        setNotice(
          `${visit.patientName} — claim rejected. Record cash payment to complete the visit.`,
        );
      } else {
        setNotice(`${visit.patientName} — claim still pending with the insurer.`);
      }
    } finally {
      setCheckingId("");
    }
  };

  const cashFallback = (visit: Visit) => {
    setMpesaVisit(visit);
  };

  const createInvoice = async () => {
    if (!invPatientId || !invAmount) {
      setInvError("Patient and amount are required.");
      return;
    }
    const amount = Number(invAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setInvError("Enter a valid amount.");
      return;
    }
    setInvBusy(true);
    setInvError("");
    try {
      await api("/billing/invoices", {
        method: "POST",
        body: JSON.stringify({
          patientId: invPatientId,
          notes: invDesc || undefined,
          lines: [
            {
              description: invDesc || "Services",
              quantity: 1,
              unitPrice: amount,
            },
          ],
        }),
      });
      setInvoiceOpen(false);
      setInvPatientId("");
      setNotice("Draft invoice created.");
      void loadOverview();
    } catch (err) {
      setInvError(err instanceof Error ? err.message : "Could not create invoice");
    } finally {
      setInvBusy(false);
    }
  };

  const stats = overview
    ? [
        {
          label: "Issued today",
          value: `KES ${formatKes(overview.todayIssuedInvoicesTotal)}`,
          delta: `${overview.todayIssuedInvoiceCount} invoice(s)`,
          icon: FileText,
        },
        {
          label: "Payments today",
          value: `KES ${formatKes(overview.todayCompletedPaymentsTotal)}`,
          delta: "completed",
          icon: Wallet,
        },
        {
          label: "Outstanding AR",
          value: `KES ${formatKes(overview.outstandingAr)}`,
          delta: "open balances",
          icon: ClipboardList,
        },
        {
          label: "Pending claims",
          value: String(overview.pendingClaimsCount),
          delta: "with insurers",
          icon: Send,
        },
      ]
    : [];

  const outstandingLabel = overview
    ? `KES ${formatKes(overview.outstandingAr)} outstanding`
    : "…";

  return (
    <RoleGuard module="billing">
      <PageHeader
        title="Billing"
        subtitle={`${billable.length} ready · ${awaitingInsurer.length} awaiting insurer · ${outstandingLabel}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/billing/invoices">
              <button
                type="button"
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground-light hover:border-brand-300 hover:text-brand-700"
              >
                Invoices
              </button>
            </Link>
            <PrimaryButton onClick={() => setInvoiceOpen(true)}>
              <Plus className="h-4 w-4" /> Create invoice
            </PrimaryButton>
            <button
              type="button"
              onClick={() => void loadOverview()}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground-light hover:border-brand-300 hover:text-brand-700"
            >
              Refresh
            </button>
          </div>
        }
      />

      {overviewError && <p className="mb-4 text-sm text-rose-500">{overviewError}</p>}
      {notice && (
        <p className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">{notice}</p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {overviewLoading &&
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        {!overviewLoading &&
          stats.map((s) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={s.value}
              icon={s.icon}
              deltaLabel={s.delta}
            />
          ))}
      </div>

      <Card className="mb-5">
        <CardHeader title="Consultation fee" />
        {awaitingConsultFee.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 pb-8 pt-2 text-center">
            <Wallet className="mb-3 h-10 w-10 text-foreground-muted" />
            <p className="text-sm font-semibold text-foreground">No pending payments</p>
          </div>
        ) : (
          <ul className="space-y-3 px-5 pb-5">
            {awaitingConsultFee.map((v) => {
              const amount = v.billing?.consultFeeAmount ?? v.billing?.total ?? 0;
              return (
                <li key={v.id} className="rounded-2xl bg-[#f3f7f7] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={v.patientName} />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{v.patientName}</p>
                        <p className="text-[11px] text-foreground-lighter">
                          {v.billing?.invoiceNumber ?? "Draft"} · KES{" "}
                          {Number(amount).toLocaleString()} · Awaiting payment
                        </p>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-foreground">
                      KES {Number(amount).toLocaleString()}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!v.billing?.invoiceId}
                      onClick={() => {
                        if (!v.billing?.invoiceId) return;
                        setPayInvoice({
                          id: v.billing.invoiceId,
                          invoiceNumber: v.billing.invoiceNumber ?? "Draft",
                          patientId: "",
                          patientName: v.patientName,
                          patientMrn: v.mrn,
                          totalAmount: String(amount),
                          outstanding: String(amount),
                          discount: "0",
                          status: "DRAFT",
                        });
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      <Wallet className="h-4 w-4" />
                      Record payment
                    </button>
                    <button
                      type="button"
                      onClick={() => setMpesaVisit(v)}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground"
                    >
                      <Smartphone className="h-4 w-4" />
                      Pay via M-Pesa
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="mb-5">
        <CardHeader
          title="Visits Ready for Billing"
          subtitle="Consultation complete — settle by cash or submit insurance claim"
        />
        {billable.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 pb-8 pt-2 text-center">
            <Wallet className="mb-3 h-10 w-10 text-foreground-muted" />
            <p className="text-sm font-semibold text-foreground">No patients awaiting payment</p>
          </div>
        ) : (
          <ul className="space-y-3 px-5 pb-5">
            {billable.map((v) => {
              const total = visitAmount(v);
              const quoted = Boolean(quotes[quoteKey(v)]);
              const insurance = v.payment.method === "INSURANCE";
              const authorized = Boolean(
                v.payment.authToken ||
                  v.payment.authorizationCode ||
                  v.payment.ediAuthGuid,
              );
              const canClaim =
                !insurance ||
                authorized ||
                v.payment.status === "PENDING"; /* manual / offline insurers */
              return (
                <li key={v.id} className="rounded-2xl bg-[#f3f7f7] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={v.patientName} />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{v.patientName}</p>
                        <p className="text-[11px] text-foreground-lighter">
                          {v.mrn} · {v.doctorName}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">
                        {quoted ? `KES ${total.toLocaleString()}` : "…"}
                      </p>
                      <p className="text-[11px] text-foreground-lighter">
                        Consultation
                        {(v.labOrder?.tests.length ?? 0) > 0
                          ? ` + ${v.labOrder?.tests.length} lab test(s)`
                          : ""}
                        {(v.prescriptions?.length ?? 0) > 0
                          ? ` + ${v.prescriptions?.length} medication(s)`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-foreground-light">
                    <span className="font-medium text-foreground-light">Diagnosis:</span>{" "}
                    {v.diagnosis || "—"}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    {insurance ? (
                      <Badge tone={authorized ? "teal" : "amber"}>
                        {v.payment.provider} ·{" "}
                        {authorized
                          ? "Visit authorized"
                          : v.payment.status === "PENDING"
                            ? "Manual cover — confirm at billing"
                            : "Cover not verified"}
                      </Badge>
                    ) : (
                      <Badge tone="slate">Paying cash</Badge>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {!insurance && (
                        <>
                          <button
                            type="button"
                            onClick={() => setCashConfirm(v)}
                            disabled={busyId === v.id || !quoted}
                            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-foreground transition hover:border-brand-300 disabled:opacity-50"
                          >
                            <Wallet className="h-3.5 w-3.5" />
                            Collect cash
                          </button>
                          <button
                            type="button"
                            onClick={() => void settle(v, "MPESA")}
                            disabled={busyId === v.id || !quoted}
                            className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
                          >
                            <Smartphone className="h-3.5 w-3.5" /> Pay with M-Pesa
                          </button>
                        </>
                      )}
                      {insurance && (
                        <button
                          type="button"
                          onClick={() => void settle(v)}
                          disabled={busyId === v.id || !canClaim || !quoted}
                          className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
                        >
                          {busyId === v.id ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting…
                            </>
                          ) : (
                            <>
                              <Send className="h-3.5 w-3.5" /> Submit Insurance Claim
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {payInvoice && (
        <RecordInvoicePaymentModal
          initialInvoice={payInvoice}
          onClose={() => setPayInvoice(null)}
          onPaid={(result) => {
            setPayInvoice(null);
            setNotice(
              `Payment recorded for ${result.invoiceNumber}. Patient can return to triage.`,
            );
            void refresh();
            void loadOverview();
            if (result.invoiceId) setPrintInvoiceId(result.invoiceId);
          }}
        />
      )}

      {mpesaVisit && (
        <MpesaCheckoutModal
          visitId={mpesaVisit.id}
          patientName={mpesaVisit.patientName}
          defaultPhone={mpesaVisit.phone}
          amount={
            mpesaVisit.stage === "AWAITING_PAYMENT"
              ? Number(mpesaVisit.billing?.consultFeeAmount ?? mpesaVisit.billing?.total ?? 0)
              : visitAmount(mpesaVisit)
          }
          source="RECEPTION"
          onClose={() => setMpesaVisit(null)}
          onPaid={() => {
            void refresh();
            void loadOverview();
            setNotice(
              mpesaVisit.stage === "AWAITING_PAYMENT"
                ? `${mpesaVisit.patientName} — consultation fee paid via M-Pesa. Patient can return to triage.`
                : `${mpesaVisit.patientName} — M-Pesa paid; receipt issued.`,
            );
            setMpesaVisit(null);
          }}
        />
      )}
      {viewReceipt && (
        <ReceiptModal receipt={viewReceipt} onClose={() => setViewReceipt(null)} />
      )}

      <Card className="mb-5">
        <CardHeader
          title="Awaiting Insurer Approval"
          subtitle="Claim filed — patient is signed off automatically when the payer accepts"
          action={
            awaitingInsurer.length > 0 ? (
              <button
                onClick={() => void refresh()}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground-light hover:border-brand-300"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            ) : undefined
          }
        />
        {awaitingInsurer.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-foreground-lighter">
            No claims pending. After you submit a claim, the visit waits here until the insurer responds.
          </p>
        ) : (
          <ul className="space-y-3 px-5 pb-5">
            {awaitingInsurer.map((v) => (
              <li key={v.id} className="rounded-2xl bg-[#f3f7f7] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={v.patientName} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{v.patientName}</p>
                      <p className="text-[11px] text-foreground-lighter">
                        {v.mrn} · {v.payment.provider} · claim{" "}
                        {v.billing?.claimId
                          ? `${v.billing.claimId.slice(0, 12)}…`
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    KES{" "}
                    {formatKes(
                      v.billing?.total ?? quotes[quoteKey(v)]?.totalAmount ?? 0,
                    )}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <Badge
                    tone={
                      (v.billing?.claimStatus === "REJECTED"
                        ? "red"
                        : v.billing?.claimStatus === "ACCEPTED"
                          ? "green"
                          : "blue") as BadgeTone
                    }
                  >
                    {v.billing?.claimStatus === "REJECTED"
                      ? "Claim rejected"
                      : v.billing?.claimStatus === "ACCEPTED"
                        ? "Claim accepted"
                        : "Awaiting insurer decision"}
                  </Badge>
                  <div className="flex flex-wrap gap-2">
                    {v.billing?.claimStatus !== "REJECTED" && (
                      <button
                        onClick={() => pollClaim(v)}
                        disabled={checkingId === v.id}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground hover:border-brand-300 disabled:opacity-50"
                      >
                        {checkingId === v.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Check status
                      </button>
                    )}
                    {v.billing?.claimStatus === "REJECTED" && (
                      <button
                        onClick={() => cashFallback(v)}
                        disabled={busyId === v.id}
                        className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                      >
                        <Smartphone className="h-3.5 w-3.5" /> Collect via M-Pesa
                      </button>
                    )}
                    {v.billing?.claimStatus === "ACCEPTED" && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Signing off…
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {completedToday.length > 0 && (
        <Card className="mb-5">
          <CardHeader title="Signed off today" subtitle="Cash settled or insurer-approved claims" />
          <ul className="divide-y divide-slate-50 px-5 pb-4">
            {completedToday.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={v.patientName} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{v.patientName}</p>
                    <p className="text-[11px] text-foreground-lighter">{v.mrn}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    KES {v.billing?.total.toLocaleString()}
                  </span>
                  {v.billing?.mode === "CLAIM" ? (
                    <Badge
                      tone={
                        v.billing.claimStatus === "ACCEPTED"
                          ? "green"
                          : v.billing.claimStatus === "REJECTED"
                            ? "amber"
                            : "blue"
                      }
                    >
                      {v.billing.claimStatus === "ACCEPTED"
                        ? "Claim accepted · signed off"
                        : v.billing.claimStatus === "REJECTED"
                          ? "Rejected · cash fallback"
                          : "Claim submitted"}
                    </Badge>
                  ) : (
                    <Badge tone="green">
                      {v.billing?.paymentChannel === "MPESA" ? "Paid M-Pesa" : "Paid"}
                    </Badge>
                  )}
                  {v.billing?.receiptId && (
                    <button
                      type="button"
                      onClick={() => void openReceipt(v.billing!.receiptId!)}
                      className="text-xs font-semibold text-brand-600 hover:underline"
                    >
                      Print receipt
                    </button>
                  )}
                  {v.billing?.invoiceId && (
                    <button
                      type="button"
                      onClick={() => setPrintInvoiceId(v.billing!.invoiceId!)}
                      className="text-xs font-semibold text-brand-600 hover:underline"
                    >
                      Print invoice
                    </button>
                  )}
                  {!v.billing?.receiptId && v.billing?.invoiceNumber && (
                    <span className="text-[11px] text-foreground-lighter">{v.billing.invoiceNumber}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {cashConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">Confirm cash collection</h3>
                <p className="mt-1 text-sm text-foreground-light">
                  This will issue the invoice, post the payment to the ledger, and mark the visit
                  complete. This cannot be undone from here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCashConfirm(null)}
                className="text-foreground-lighter hover:text-foreground-light"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-xl bg-[#f3f7f7] px-3.5 py-3 text-sm">
              <p className="font-semibold text-foreground">{cashConfirm.patientName}</p>
              <p className="text-[11px] text-foreground-light">
                {cashConfirm.mrn}
                {cashConfirm.diagnosis ? ` · ${cashConfirm.diagnosis}` : ""}
              </p>
              <p className="mt-2 text-lg font-bold text-foreground">
                KES {visitAmount(cashConfirm).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyId === cashConfirm.id}
                onClick={() => void settle(cashConfirm, "CASH")}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busyId === cashConfirm.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wallet className="h-4 w-4" />
                )}
                {busyId === cashConfirm.id ? "Recording…" : "Yes, collect cash"}
              </button>
              <button
                type="button"
                disabled={busyId === cashConfirm.id}
                onClick={() => setCashConfirm(null)}
                className="rounded-full border border-border px-4 py-2.5 text-sm font-medium text-foreground-light disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {printInvoiceId && (
        <InvoicePrintModal
          invoiceId={printInvoiceId}
          onClose={() => setPrintInvoiceId("")}
        />
      )}

      {invoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Create draft invoice</h3>
              <button onClick={() => setInvoiceOpen(false)} className="text-foreground-lighter hover:text-foreground-light">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <FieldLabel required>Patient</FieldLabel>
                <PatientSearchSelect
                  value={invPatientId}
                  onChange={(id) => setInvPatientId(id)}
                />
              </div>
              <div>
                <FieldLabel required>Amount (KES)</FieldLabel>
                <input
                  className={inputClass}
                  value={invAmount}
                  onChange={(e) => setInvAmount(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div>
                <FieldLabel optional>Description</FieldLabel>
                <input
                  className={inputClass}
                  value={invDesc}
                  onChange={(e) => setInvDesc(e.target.value)}
                />
              </div>
              {invError && <p className="text-[11px] font-medium text-rose-500">{invError}</p>}
              <button
                onClick={createInvoice}
                disabled={invBusy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {invBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create draft
              </button>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
