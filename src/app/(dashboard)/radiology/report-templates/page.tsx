"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FieldLabel } from "@/components/field-label";
import { RoleGuard } from "@/components/role-guard";
import { Badge, Card, PageHeader, PrimaryButton, Table } from "@/components/ui";
import { api } from "@/lib/api";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

const SECTION_TYPES = ["text", "number", "date", "boolean"] as const;

type Section = { key: string; label: string; type: string; required?: boolean };

type ReportTemplate = {
  id: string;
  name: string;
  modality: string | null;
  bodyRegion: string | null;
  sections: Section[];
  isActive: boolean;
};

const EMPTY_FORM = {
  name: "",
  modality: "",
  bodyRegion: "",
  sections: [] as Section[],
};

export default function RadiologyReportTemplatesPage() {
  const [rows, setRows] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api<ReportTemplate[]>("/imaging/report-templates"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load report templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (row: ReportTemplate) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      modality: row.modality ?? "",
      bodyRegion: row.bodyRegion ?? "",
      sections: row.sections.map((s) => ({ ...s })),
    });
    setFormError("");
    setShowModal(true);
  };

  const addSection = () => {
    setForm((f) => ({
      ...f,
      sections: [...f.sections, { key: "", label: "", type: "text", required: false }],
    }));
  };

  const updateSection = (index: number, patch: Partial<Section>) => {
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  };

  const removeSection = (index: number) => {
    setForm((f) => ({ ...f, sections: f.sections.filter((_, i) => i !== index) }));
  };

  const submit = async () => {
    if (!form.name.trim()) {
      setFormError("Template name is required.");
      return;
    }
    for (const s of form.sections) {
      if (!s.key.trim() || !s.label.trim()) {
        setFormError("Every section needs both a key and a label.");
        return;
      }
    }
    setSaving(true);
    setFormError("");
    const body = {
      name: form.name.trim(),
      modality: form.modality.trim() || undefined,
      bodyRegion: form.bodyRegion.trim() || undefined,
      sections: form.sections.map((s) => ({
        key: s.key.trim(),
        label: s.label.trim(),
        type: s.type,
        required: s.required ?? false,
      })),
    };
    try {
      if (editingId) {
        await api(`/imaging/report-templates/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await api("/imaging/report-templates", { method: "POST", body: JSON.stringify(body) });
      }
      setShowModal(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save report template");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: ReportTemplate) => {
    try {
      await api(`/imaging/report-templates/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update template status");
    }
  };

  return (
    <RoleGuard module="radiology">
      <PageHeader
        title="Report templates"
        subtitle={
          loading ? "Loading report templates…" : `${rows.length} configured report templates`
        }
        action={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" />
            New template
          </button>
        }
      />
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      <Card>
        <Table headers={["Name", "Modality", "Body region", "Sections", "Status", ""]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
              <td className="px-4 py-3 text-foreground-light">{r.modality ?? "—"}</td>
              <td className="px-4 py-3 text-foreground-light">{r.bodyRegion ?? "—"}</td>
              <td className="px-4 py-3 text-foreground-light">{r.sections.length}</td>
              <td className="px-4 py-3">
                <button type="button" onClick={() => void toggleActive(r)}>
                  <Badge tone={r.isActive ? "green" : "slate"}>
                    {r.isActive ? "Active" : "Inactive"}
                  </Badge>
                </button>
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  className="text-xs font-medium text-brand-700 hover:underline"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-sm text-foreground-lighter">
                No report templates configured yet.
              </td>
            </tr>
          )}
        </Table>
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">
                {editingId ? "Edit report template" : "New report template"}
              </h2>
              <button type="button" onClick={() => setShowModal(false)}>
                <X className="h-4 w-4 text-foreground-lighter" />
              </button>
            </div>
            <div>
              <FieldLabel required>Name</FieldLabel>
              <input
                className={inputClass}
                placeholder="e.g. Obstetric Ultrasound"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel optional>Modality</FieldLabel>
                <input
                  className={inputClass}
                  placeholder="e.g. Ultrasound"
                  value={form.modality}
                  onChange={(e) => setForm({ ...form, modality: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel optional>Body region</FieldLabel>
                <input
                  className={inputClass}
                  placeholder="e.g. Pelvic"
                  value={form.bodyRegion}
                  onChange={(e) => setForm({ ...form, bodyRegion: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FieldLabel optional>Structured measurement sections</FieldLabel>
                <button
                  type="button"
                  onClick={addSection}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground hover:border-brand-300"
                >
                  <Plus className="h-3.5 w-3.5" /> Add section
                </button>
              </div>
              {form.sections.length === 0 && (
                <p className="text-xs text-foreground-lighter">
                  No structured sections — this template will only carry narrative findings and
                  impression text.
                </p>
              )}
              {form.sections.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-border p-2">
                  <input
                    className={inputClass}
                    placeholder="key (e.g. gestAge)"
                    value={s.key}
                    onChange={(e) => updateSection(i, { key: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    placeholder="Label (e.g. Gestational Age)"
                    value={s.label}
                    onChange={(e) => updateSection(i, { label: e.target.value })}
                  />
                  <select
                    className={inputClass}
                    value={s.type}
                    onChange={(e) => updateSection(i, { type: e.target.value })}
                  >
                    {SECTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeSection(i)}
                    className="shrink-0 rounded-lg p-2 text-foreground-muted hover:bg-surface-200 hover:text-rose-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {formError && <p className="text-sm text-rose-600">{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground-light hover:border-brand-300"
              >
                Cancel
              </button>
              <PrimaryButton onClick={() => void submit()} disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Create template"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
