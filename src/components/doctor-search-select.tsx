"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { buildListQuery } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { CatalogDoctor } from "@/lib/catalog";

export function DoctorSearchSelect({
  value,
  onChange,
  placeholder = "Search doctor by name or specialty…",
  disabled,
}: {
  value: string;
  onChange: (doctorId: string, doctor?: CatalogDoctor) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<CatalogDoctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debounced = useDebouncedValue(query, 300);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    setError("");
    try {
      const qs = buildListQuery({ page: 1, limit: 20, search: q || undefined });
      const res = await api<{ items: CatalogDoctor[] }>(`/catalog/doctors?${qs}`);
      setHits(res.items ?? []);
      if (!(res.items ?? []).length && !q) {
        setError("No doctors found. Ensure doctor staff profiles exist in the system.");
      }
    } catch (err) {
      setHits([]);
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not load doctors",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void search(debounced.trim());
  }, [debounced, open, search]);

  return (
    <div className="relative">
      <input
        className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
        placeholder={selectedLabel || placeholder}
        value={open ? query : selectedLabel || query}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 180)}
        aria-controls={listId}
        autoComplete="off"
      />
      {open && (
        <ul
          id={listId}
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          {loading && (
            <li className="px-3 py-2 text-xs text-foreground-lighter">Searching…</li>
          )}
          {!loading && error && (
            <li className="px-3 py-2 text-xs text-rose-500">{error}</li>
          )}
          {!loading && !error && hits.length === 0 && (
            <li className="px-3 py-2 text-xs text-foreground-lighter">No matching doctors.</li>
          )}
          {hits.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className="flex w-full flex-col px-3 py-2 text-left hover:bg-brand-50 dark:hover:bg-surface-200"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(d.id, d);
                  setSelectedLabel(`${d.name} · ${d.specialty}`);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="text-sm font-medium text-foreground">{d.name}</span>
                <span className="text-[11px] text-foreground-lighter">
                  {d.specialty}
                  {d.available === false ? " · unavailable" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!open && value && selectedLabel && (
        <p className="mt-1 text-[11px] text-foreground-light">Assigned: {selectedLabel}</p>
      )}
    </div>
  );
}
