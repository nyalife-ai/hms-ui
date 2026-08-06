"use client";

import { CheckCircle2, Loader2, Plus, RefreshCw, Send, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { MpesaCheckoutModal } from "@/components/mpesa-checkout";
import { ReceiptModal, type ReceiptData } from "@/components/receipt-modal";
import { RoleGuard } from "@/components/role-guard";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  PageHeader,
  PrimaryButton,
  Table,
  cell,
  type BadgeTone,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useFeeSchedule, useInvoices, usePatients } from "@/lib/catalog";
import { useVisits, type Visit } from "@/lib/visits";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

const STATUS_TONES: Record<string, BadgeTone> = {
  Paid: "green",
  Pending: "blue",
  Partial: "amber",
  Overdue: "red",
};

function visitTotal(
  visit: Visit,
  fees: { consult: number; lab: number; medication: number },
): number {
  const tests = visit.labOrder?.tests.length ?? 0;
  const meds = visit.prescriptions?.length ?? 0;
  return fees.consult + tests * fees.lab + meds * fees.medication;
}

function claimItems(
  visit: Visit,
  fees: { consult: number; lab: number; medication: number },
) {
  return [
    { description: "Consultation", amount: fees.consult },
    ...(visit.labOrder?.tests ?? []).map((t) => ({
      description: `Lab: ${t.name}`,
      amount: fees.lab,
    })),
    ...(visit.prescriptions ?? []).map((p) => ({
      description: `Medication: ${p.medication}`,
      amount: fees.medication,
    })),
  ];
}

export default function BillingPage() {
  const { visits, finalizeBilling, syncClaim, refresh } = useVisits();
  const { data: invoices, refresh: refreshInvoices } = useInvoices();
  const { data: patients } = usePatients();
  const { fees } = useFeeSchedule();
  const billable = visits.filter((v) => v.stage === "READY_FOR_BILLING");
  const awaitingInsurer = visits.filter((v) => v.stage === "CLAIM_SUBMITTED");
  const completedToday = visits.filter((v) => v.stage === "COMPLETED");
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

  const outstanding = invoices
    .filter((i) => i.status !== "Paid")
    .reduce((sum, i) => sum + i.amount, 0);

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
            await refreshInvoices();
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

  const settle = async (visit: Visit) => {
    const total = visitTotal(visit, fees);
    if (visit.payment.method !== "INSURANCE") {
      setMpesaVisit(visit);
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
            items: claimItems(visit, fees),
            total,
          },
        }),
      });
      if (!data.ok) {
        window.alert(data.error || "Claim submission failed.");
        return;
      }
      // Hold visit at CLAIM_SUBMITTED — do not complete until insurer accepts
      await finalizeBilling(visit.id, total, data.claimId);
      await refreshInvoices();
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
        await refreshInvoices();
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
    // After claim rejection, collect via M-Pesa at reception
    setMpesaVisit(visit);
  };

  const createInvoice = async () => {
    if (!invPatientId || !invAmount) {
      setInvError("Patient and amount are required.");
      return;
    }
    setInvBusy(true);
    setInvError("");
    try {
      await api("/ops/invoices", {
        method: "POST",
        body: JSON.stringify({
          patientId: invPatientId,
          amount: Number(invAmount),
          description: invDesc || "Services",
        }),
      });
      setInvoiceOpen(false);
      await refreshInvoices();
    } catch (err) {
      setInvError(err instanceof Error ? err.message : "Could not create invoice");
    } finally {
      setInvBusy(false);
    }
  };

  return (
    <RoleGuard module="billing">
      <PageHeader
        title="Billing"
        subtitle={`${billable.length} ready · ${awaitingInsurer.length} awaiting insurer · KES ${outstanding.toLocaleString()} outstanding`}
        action={
          <PrimaryButton onClick={() => setInvoiceOpen(true)}>
            <Plus className="h-4 w-4" /> Create invoice
          </PrimaryButton>
        }
      />

      {notice && (
        <p className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">{notice}</p>
      )}

      <Card className="mb-5">
        <CardHeader
          title="Visits Ready for Billing"
          subtitle="Consultation complete — settle by cash or submit insurance claim"
        />
        {billable.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-slate-400">
            Nothing waiting. Visits arrive here when the doctor completes a consultation.
          </p>
        ) : (
          <ul className="space-y-3 px-5 pb-5">
            {billable.map((v) => {
              const total = visitTotal(v, fees);
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
                        <p className="text-sm font-semibold text-slate-800">{v.patientName}</p>
                        <p className="text-[11px] text-slate-400">
                          {v.mrn} · {v.doctorName}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900">
                        KES {total.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-slate-400">
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

                  <p className="mt-3 text-xs text-slate-500">
                    <span className="font-medium text-slate-600">Diagnosis:</span>{" "}
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
                    <button
                      onClick={() => settle(v)}
                      disabled={busyId === v.id || !canClaim}
                      className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
                    >
                      {busyId === v.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting…
                        </>
                      ) : insurance ? (
                        <>
                          <Send className="h-3.5 w-3.5" /> Submit Insurance Claim
                        </>
                      ) : (
                        <>
                          <Smartphone className="h-3.5 w-3.5" /> Pay with M-Pesa
                        </>
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {mpesaVisit && (
        <MpesaCheckoutModal
          visitId={mpesaVisit.id}
          patientName={mpesaVisit.patientName}
          defaultPhone={mpesaVisit.phone}
          amount={visitTotal(mpesaVisit, fees)}
          source="RECEPTION"
          onClose={() => setMpesaVisit(null)}
          onPaid={() => {
            void refresh();
            void refreshInvoices();
            setNotice(`${mpesaVisit.patientName} — M-Pesa paid; receipt issued.`);
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
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-300"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            ) : undefined
          }
        />
        {awaitingInsurer.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-slate-400">
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
                      <p className="text-sm font-semibold text-slate-800">{v.patientName}</p>
                      <p className="text-[11px] text-slate-400">
                        {v.mrn} · {v.payment.provider} · claim{" "}
                        {v.billing?.claimId
                          ? `${v.billing.claimId.slice(0, 12)}…`
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    KES {(v.billing?.total ?? visitTotal(v, fees)).toLocaleString()}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <Badge
                    tone={
                      v.billing?.claimStatus === "REJECTED"
                        ? "red"
                        : v.billing?.claimStatus === "ACCEPTED"
                          ? "green"
                          : "blue"
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
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-300 disabled:opacity-50"
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
                    <p className="text-sm font-semibold text-slate-800">{v.patientName}</p>
                    <p className="text-[11px] text-slate-400">{v.mrn}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700">
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
                      onClick={() => void openReceipt(v.billing!.receiptId!)}
                      className="text-xs font-semibold text-brand-600 hover:underline"
                    >
                      {v.billing.receiptNumber || "Receipt"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader title="Invoices" subtitle="Recent invoice history" />
        <Table headers={["Invoice", "Patient", "Amount (KES)", "Issued", "Due", "Status"]}>
          {invoices.map((inv) => (
            <tr key={inv.id} className="transition hover:bg-slate-50/60">
              <td className={`${cell} font-semibold text-slate-800`}>{inv.number}</td>
              <td className={cell}>
                <div className="flex items-center gap-3">
                  <Avatar name={inv.patient} size="sm" />
                  <span className="text-slate-600">{inv.patient}</span>
                </div>
              </td>
              <td className={`${cell} text-slate-500`}>{inv.amount.toLocaleString()}</td>
              <td className={`${cell} text-slate-500`}>{inv.issued}</td>
              <td className={`${cell} text-slate-500`}>{inv.due}</td>
              <td className={cell}>
                <Badge tone={STATUS_TONES[inv.status] ?? "slate"}>{inv.status}</Badge>
              </td>
            </tr>
          ))}
        </Table>
        {invoices.length === 0 && (
          <p className="px-5 pb-5 text-sm text-slate-400">No invoices yet.</p>
        )}
      </Card>

      {invoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Create invoice</h3>
              <button onClick={() => setInvoiceOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Patient</label>
                <select
                  className={`mt-1.5 ${inputClass}`}
                  value={invPatientId}
                  onChange={(e) => setInvPatientId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.mrn}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Amount (KES)</label>
                <input
                  className={`mt-1.5 ${inputClass}`}
                  value={invAmount}
                  onChange={(e) => setInvAmount(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Description</label>
                <input
                  className={`mt-1.5 ${inputClass}`}
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
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
