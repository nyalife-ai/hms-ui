"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export type PickerOption = {
  id: string;
  label: string;
  sublabel?: string;
  group?: string;
};

type Props = {
  options: PickerOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Exclude already-selected ids from the dropdown. */
  excludeIds?: string[];
  onSelect: (option: PickerOption) => void;
  emptyMessage?: string;
};

export function SearchablePicker({
  options,
  placeholder = "Search…",
  disabled,
  excludeIds = [],
  onSelect,
  emptyMessage = "No matches",
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return options.filter((o) => {
      if (excluded.has(o.id)) return false;
      if (!needle) return true;
      return (
        o.label.toLowerCase().includes(needle) ||
        (o.sublabel?.toLowerCase().includes(needle) ?? false) ||
        (o.group?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [options, q, excluded]);

  const grouped = useMemo(() => {
    const map = new Map<string, PickerOption[]>();
    for (const opt of filtered) {
      const key = opt.group?.trim() || "General";
      const list = map.get(key) ?? [];
      list.push(opt);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <div
        className={`flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 ${
          open ? "border-brand-400 ring-2 ring-brand-400/20" : "border-slate-200"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          placeholder={placeholder}
          value={q}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
        />
        {q ? (
          <button
            type="button"
            className="text-slate-300 hover:text-slate-500"
            onClick={() => setQ("")}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-300" />
        )}
      </div>

      {open && !disabled && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-slate-400">{emptyMessage}</p>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group}>
                <p className="sticky top-0 bg-slate-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {group}
                </p>
                {items.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-brand-50"
                    onClick={() => {
                      onSelect(opt);
                      setQ("");
                      setOpen(false);
                    }}
                  >
                    <span className="font-medium text-slate-800">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-xs text-slate-400">{opt.sublabel}</span>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
