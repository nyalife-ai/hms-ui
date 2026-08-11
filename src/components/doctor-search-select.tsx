"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { api } from "@/lib/api";
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
  const debounced = useDebouncedValue(query, 400);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const qs = buildListQuery({ page: 1, limit: 20, search: q || undefined });
      const res = await api<{ items: CatalogDoctor[] }>(`/catalog/doctors?${qs}`);
      setHits(res.items ?? []);
    } catch {
      setHits([]);
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
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
        placeholder={selectedLabel || placeholder}
        value={open ? query : selectedLabel || query}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        aria-controls={listId}
        autoComplete="off"
      />
      {open && (
        <ul
          id={listId}
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-100 bg-white py-1 shadow-lg"
        >
          {loading && <li className="px-3 py-2 text-xs text-slate-400">Searching…</li>}
          {!loading && hits.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-400">No matching doctors.</li>
          )}
          {hits.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className="flex w-full flex-col px-3 py-2 text-left hover:bg-brand-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(d.id, d);
                  setSelectedLabel(`${d.name} · ${d.specialty}`);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="text-sm font-medium text-slate-800">{d.name}</span>
                <span className="text-[11px] text-slate-400">{d.specialty}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
