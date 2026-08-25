"use client";

import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  RefreshCw,
  Search,
  Shield,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FieldLabel } from "@/components/field-label";
import { RoleGuard } from "@/components/role-guard";
import {
  Badge,
  Card,
  CardHeader,
  PageHeader,
  type BadgeTone,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type ChangedField = { field: string; from: unknown; to: unknown };

type AuditActor = { id: string; email: string; name: string };

type AuditLogListItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  ipAddress: string | null;
  createdAt: string;
  changedFieldCount: number;
  changedFieldsPreview: ChangedField[];
};

type AuditLogDetail = AuditLogListItem & {
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  changedFields: ChangedField[];
  userAgent: string | null;
};

const ACTION_TONE: Record<string, BadgeTone> = {
  CREATE: "teal",
  UPDATE: "amber",
  DELETE: "red",
  RESTORE: "blue",
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "null";
  } catch {
    return String(value);
  }
}

function shortValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") {
    return value.length > 80 ? `${value.slice(0, 80)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const s = JSON.stringify(value);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}

export default function AuditLogsPage() {
  const [items, setItems] = useState<AuditLogListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actors, setActors] = useState<AuditActor[]>([]);
  const [detail, setDetail] = useState<AuditLogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 400);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (debouncedSearch.trim()) qs.set("search", debouncedSearch.trim());
      if (userId) qs.set("userId", userId);
      if (action) qs.set("action", action);
      if (entityType.trim()) qs.set("entityType", entityType.trim());
      if (from) qs.set("from", new Date(from).toISOString());
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        qs.set("to", end.toISOString());
      }
      const res = await api<{
        items: AuditLogListItem[];
        total: number;
        page: number;
        limit: number;
      }>(`/audit-logs?${qs.toString()}`);
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load audit logs");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, userId, action, entityType, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api<AuditActor[]>("/audit-logs/actors");
        if (!cancelled) setActors(list ?? []);
      } catch {
        /* optional filter source */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, userId, action, entityType, from, to]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setError("");
    try {
      const row = await api<AuditLogDetail>(`/audit-logs/${id}`);
      setDetail(row);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load log detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / limit));

  return (
    <RoleGuard module="settings">
      <PageHeader
        title="Audit logs"
        subtitle="Immutable record of data changes — visible to administrators only"
      />

      <Card className="mb-4">
        <CardHeader
          title="Filters"
          subtitle="Search by user, entity, action, or time range"
          action={
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground-light hover:border-brand-300 hover:text-brand-700"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          }
        />
        <div className="grid grid-cols-1 gap-3 px-5 pb-5 md:grid-cols-2 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <FieldLabel>Search</FieldLabel>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-lighter" />
              <input
                className={`${inputClass} pl-9`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Entity type, email, IP, UUID…"
              />
            </div>
          </div>
          <div>
            <FieldLabel>User</FieldLabel>
            <select
              className={`mt-1.5 ${inputClass}`}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">All users</option>
              {actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Action</FieldLabel>
            <select
              className={`mt-1.5 ${inputClass}`}
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="">All actions</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="RESTORE">RESTORE</option>
            </select>
          </div>
          <div>
            <FieldLabel>Entity type</FieldLabel>
            <input
              className={`mt-1.5 ${inputClass}`}
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              placeholder="e.g. Patients, OutpatientVisits"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>From</FieldLabel>
              <input
                className={`mt-1.5 ${inputClass}`}
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>To</FieldLabel>
              <input
                className={`mt-1.5 ${inputClass}`}
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {error && (
        <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>
      )}

      <Card>
        <CardHeader
          title="Mutation history"
          subtitle={`${total.toLocaleString()} event${total === 1 ? "" : "s"}`}
        />
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-foreground-lighter">
                <th className="py-2 pr-3 font-semibold">When</th>
                <th className="py-2 pr-3 font-semibold">Action</th>
                <th className="py-2 pr-3 font-semibold">Entity</th>
                <th className="py-2 pr-3 font-semibold">User</th>
                <th className="py-2 pr-3 font-semibold">Changes</th>
                <th className="py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-foreground-lighter">
                    Loading audit events…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-foreground-lighter">
                    <Shield className="mx-auto mb-2 h-8 w-8 text-foreground-muted" />
                    No audit events match these filters.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border last:border-0 hover:bg-brand-50/40"
                  >
                    <td className="py-3 pr-3 text-foreground-light whitespace-nowrap">
                      {formatWhen(row.createdAt)}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge tone={ACTION_TONE[row.action] ?? "slate"}>
                        {row.action}
                      </Badge>
                    </td>
                    <td className="py-3 pr-3">
                      <p className="font-medium text-foreground">{row.entityType}</p>
                      <p className="font-mono text-[10px] text-foreground-lighter">
                        {row.entityId.slice(0, 8)}…
                      </p>
                    </td>
                    <td className="py-3 pr-3">
                      <p className="text-foreground">
                        {row.userName || row.userEmail || "System / unknown"}
                      </p>
                      {row.userName && row.userEmail && (
                        <p className="text-[11px] text-foreground-lighter">{row.userEmail}</p>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-foreground-light">
                      {row.changedFieldCount > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Filter className="h-3.5 w-3.5 text-brand-500" />
                          {row.changedFieldCount} field
                          {row.changedFieldCount === 1 ? "" : "s"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void openDetail(row.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-brand-700 hover:border-brand-300 hover:bg-brand-50"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <p className="text-xs text-foreground-lighter">
              Page {page} of {pageCount}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground-light disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <button
                type="button"
                disabled={page >= pageCount || loading}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground-light disabled:opacity-40"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Audit detail</h2>
                <p className="text-xs text-foreground-lighter">
                  Sensitive fields (email, phone, OTP, tokens) are masked in storage.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-full p-1 text-foreground-lighter hover:bg-surface-200 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {detailLoading && !detail && (
              <p className="py-10 text-center text-sm text-foreground-lighter">Loading…</p>
            )}

            {detail && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-foreground-lighter">
                      When
                    </p>
                    <p className="text-foreground">{formatWhen(detail.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-foreground-lighter">
                      Action
                    </p>
                    <Badge tone={ACTION_TONE[detail.action] ?? "slate"}>
                      {detail.action}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-foreground-lighter">
                      Entity
                    </p>
                    <p className="font-medium text-foreground">{detail.entityType}</p>
                    <p className="break-all font-mono text-[10px] text-foreground-lighter">
                      {detail.entityId}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-foreground-lighter">
                      Actor
                    </p>
                    <p className="text-foreground">
                      {detail.userName || detail.userEmail || "System / unknown"}
                    </p>
                    {detail.userEmail && (
                      <p className="text-[11px] text-foreground-lighter">{detail.userEmail}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-foreground-lighter">
                      IP
                    </p>
                    <p className="text-foreground">{detail.ipAddress || "—"}</p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <p className="text-[11px] font-semibold uppercase text-foreground-lighter">
                      User agent
                    </p>
                    <p className="line-clamp-2 text-[11px] text-foreground-light">
                      {detail.userAgent || "—"}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">
                    Fields changed
                  </h3>
                  {detail.changedFields.length === 0 ? (
                    <p className="text-sm text-foreground-lighter">No field-level diff recorded.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-200 text-[10px] uppercase text-foreground-lighter">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Field</th>
                            <th className="px-3 py-2 font-semibold">From</th>
                            <th className="px-3 py-2 font-semibold">To</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.changedFields.map((c) => (
                            <tr
                              key={c.field}
                              className="border-t border-border align-top"
                            >
                              <td className="px-3 py-2 font-medium text-foreground">
                                {c.field}
                              </td>
                              <td className="px-3 py-2 font-mono text-rose-600/90">
                                {shortValue(c.from)}
                              </td>
                              <td className="px-3 py-2 font-mono text-teal-700">
                                {shortValue(c.to)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-foreground">
                      Old values
                    </h3>
                    <pre className="max-h-64 overflow-auto rounded-xl bg-surface-200 p-3 text-[11px] leading-relaxed text-foreground-light">
                      {prettyJson(detail.oldValues)}
                    </pre>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-foreground">
                      New values
                    </h3>
                    <pre className="max-h-64 overflow-auto rounded-xl bg-brand-50/50 p-3 text-[11px] leading-relaxed text-foreground-light">
                      {prettyJson(detail.newValues)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
