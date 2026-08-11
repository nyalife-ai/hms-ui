"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { api } from "@/lib/api";
import { buildListQuery } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { CatalogPatient } from "@/lib/catalog";

type PatientHit = CatalogPatient;

/**
 * Searchable patient selector — server-side search via /catalog/patients.
 * Does not preload the full patient database.
 */
export function PatientSearchSelect({
  value,
  onChange,
  placeholder = "Search patient by name, phone, or MRN…",
  disabled,
  displayLabel,
}: {
  value: string;
  onChange: (patientId: string, patient?: PatientHit) => void;
  placeholder?: string;
  disabled?: boolean;
  /** When set (e.g. after creating a patient), shows this label for the selected id. */
  displayLabel?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<PatientHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debounced = useDebouncedValue(query, 400);

  useEffect(() => {
    if (displayLabel && value) {
      setSelectedLabel(displayLabel);
    }
  }, [displayLabel, value]);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    setError("");
    try {
      const qs = buildListQuery({
        page: 1,
        limit: 20,
        search: q || undefined,
      });
      const res = await api<{ items: PatientHit[] }>(`/catalog/patients?${qs}`);
      setHits(res.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to search patients");
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void search(debounced.trim());
  }, [debounced, open, search]);

  useEffect(() => {
    if (!value) {
      setSelectedLabel("");
      return;
    }
    // Keep label if already set for this id
  }, [value]);

  return (
    <div className="relative">
      <input
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
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
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-100 bg-white py-1 shadow-lg"
        >
          {loading && (
            <li className="px-3 py-2 text-xs text-slate-400">Searching…</li>
          )}
          {!loading && error && (
            <li className="px-3 py-2 text-xs text-rose-500">{error}</li>
          )}
          {!loading && !error && hits.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-400">No matching patients.</li>
          )}
          {hits.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full flex-col px-3 py-2 text-left hover:bg-brand-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(p.id, p);
                  setSelectedLabel(`${p.name} · ${p.mrn}`);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="text-sm font-medium text-slate-800">{p.name}</span>
                <span className="text-[11px] text-slate-400">
                  {p.mrn}
                  {p.phone ? ` · ${p.phone}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
