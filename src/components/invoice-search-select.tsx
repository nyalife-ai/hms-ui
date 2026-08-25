"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { api } from "@/lib/api";
import { buildListQuery, unwrapPage } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

export type InvoiceHit = {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  totalAmount: string;
  outstanding: string;
  /** Alias of allocated — amount paid toward this invoice */
  amountPaid?: string;
  allocated?: string;
  balance?: string;
  subtotal?: string;
  tax?: string;
  discount: string;
  status: string;
};

/**
 * Searchable invoice selector — invoice #, patient name, or MRN.
 * Prefer payable invoices (draft / issued / partially paid).
 */
export function InvoiceSearchSelect({
  value,
  onChange,
  patientId,
  placeholder = "Search invoice #, patient, or MRN…",
  disabled,
  payableOnly = true,
}: {
  value: string;
  onChange: (invoiceId: string, invoice?: InvoiceHit) => void;
  patientId?: string;
  placeholder?: string;
  disabled?: boolean;
  /** When true, only DRAFT / ISSUED / PARTIALLY_PAID */
  payableOnly?: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<InvoiceHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debounced = useDebouncedValue(query, 400);

  const search = useCallback(
    async (q: string) => {
      setLoading(true);
      setError("");
      try {
        const statuses = payableOnly
          ? (["DRAFT", "ISSUED", "PARTIALLY_PAID"] as const)
          : ([""] as const);
        const pages = await Promise.all(
          statuses.map(async (status) => {
            const qs = buildListQuery({
              page: 1,
              limit: 20,
              search: q || undefined,
              status: status || undefined,
              patientId: patientId || undefined,
            });
            return unwrapPage<InvoiceHit>(await api(`/billing/invoices?${qs}`));
          }),
        );
        const byId = new Map<string, InvoiceHit>();
        for (const page of pages) {
          for (const inv of page.items) byId.set(inv.id, inv);
        }
        setHits([...byId.values()].slice(0, 30));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to search invoices");
        setHits([]);
      } finally {
        setLoading(false);
      }
    },
    [patientId, payableOnly],
  );

  useEffect(() => {
    if (!open) return;
    void search(debounced.trim());
  }, [debounced, open, search]);

  useEffect(() => {
    if (!value) setSelectedLabel("");
  }, [value]);

  const dueLabel = (inv: InvoiceHit) => {
    if (inv.status === "DRAFT") return `Draft · KES ${Number(inv.totalAmount).toLocaleString()}`;
    return `Due KES ${Number(inv.outstanding || inv.totalAmount).toLocaleString()}`;
  };

  return (
    <div className="relative">
      <input
        className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
        placeholder={selectedLabel || placeholder}
        value={open ? query : selectedLabel || query}
        disabled={disabled}
        onFocus={() => {
          setOpen(true);
          if (selectedLabel) setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
        aria-autocomplete="list"
        aria-controls={listId}
        autoComplete="off"
      />
      {open && (
        <ul
          id={listId}
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-white py-1 shadow-lg"
        >
          {loading && <li className="px-3 py-2 text-xs text-foreground-lighter">Searching…</li>}
          {!loading && error && (
            <li className="px-3 py-2 text-xs text-rose-500">{error}</li>
          )}
          {!loading && !error && hits.length === 0 && (
            <li className="px-3 py-2 text-xs text-foreground-lighter">No matching invoices.</li>
          )}
          {hits.map((inv) => (
            <li key={inv.id}>
              <button
                type="button"
                className="flex w-full flex-col px-3 py-2 text-left hover:bg-brand-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(inv.id, inv);
                  setSelectedLabel(
                    `${inv.invoiceNumber} · ${inv.patientName} · ${dueLabel(inv)}`,
                  );
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="text-sm font-medium text-foreground">
                  {inv.invoiceNumber}
                  <span className="ml-2 text-[11px] font-normal text-foreground-lighter">
                    {inv.status.replaceAll("_", " ")}
                  </span>
                </span>
                <span className="text-[11px] text-foreground-lighter">
                  {inv.patientName} · {inv.patientMrn} · {dueLabel(inv)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
