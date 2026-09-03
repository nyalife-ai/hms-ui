"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, ApiError } from "@/lib/api";
import { buildListQuery, unwrapPage } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { CatalogDoctor } from "@/lib/catalog";

/** Strip titles so "dr amina" matches first name "Amina". */
function normalizeDoctorQuery(q: string): string {
  return q
    .replace(/^(dr\.?|doctor)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

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
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<CatalogDoctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const debounced = useDebouncedValue(query, 250);

  const updateMenuBox = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuBox({
      top: r.bottom + 4,
      left: r.left,
      width: r.width,
    });
  }, []);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    setError("");
    try {
      const normalized = normalizeDoctorQuery(q);
      const qs = buildListQuery({
        page: 1,
        limit: 20,
        search: normalized || undefined,
      });
      const raw = await api<unknown>(`/catalog/doctors?${qs}`);
      const page = unwrapPage<CatalogDoctor>(raw);
      setHits(page.items);
      if (!page.items.length) {
        setError(
          normalized
            ? `No doctors match “${normalized}”. Try a last name or specialty.`
            : "No doctors found. Ask admin to seed doctor staff profiles.",
        );
      }
    } catch (err) {
      setHits([]);
      setError(
        err instanceof ApiError
          ? `Could not load doctors (${err.status}): ${err.message}`
          : err instanceof Error
            ? err.message
            : "Could not load doctors — is the API running?",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void search(debounced);
  }, [debounced, open, search]);

  useEffect(() => {
    if (!open) {
      setMenuBox(null);
      return;
    }
    updateMenuBox();
    const onScroll = () => updateMenuBox();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updateMenuBox]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        const portal = document.getElementById(listId);
        if (portal?.contains(e.target as Node)) return;
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, listId]);

  const menu =
    open &&
    menuBox &&
    typeof document !== "undefined" &&
    createPortal(
      <ul
        id={listId}
        role="listbox"
        style={{
          position: "fixed",
          top: menuBox.top,
          left: menuBox.left,
          width: menuBox.width,
          zIndex: 9999,
        }}
        className="max-h-56 overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-lg"
      >
        {loading && (
          <li className="px-3 py-2 text-xs text-foreground-lighter">Searching doctors…</li>
        )}
        {!loading && error && (
          <li className="px-3 py-2 text-xs text-rose-500">{error}</li>
        )}
        {!loading &&
          hits.map((d) => (
            <li key={d.id} role="option">
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
      </ul>,
      document.body,
    );

  return (
    <div className="relative" ref={wrapRef}>
      <input
        ref={inputRef}
        className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
        placeholder={selectedLabel || placeholder}
        value={open ? query : selectedLabel || query}
        disabled={disabled}
        onFocus={() => {
          setOpen(true);
          updateMenuBox();
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        aria-controls={listId}
        aria-expanded={open}
        autoComplete="off"
      />
      {menu}
      {!open && error && !value && (
        <p className="mt-1 text-[11px] text-rose-500">{error}</p>
      )}
      {!open && value && selectedLabel && (
        <p className="mt-1 text-[11px] text-foreground-light">Assigned: {selectedLabel}</p>
      )}
      {!value && !error && (
        <p className="mt-1 text-[11px] text-foreground-lighter">
          Click the field and pick a doctor from the list (try “amina”, not “dr amina”).
        </p>
      )}
    </div>
  );
}
