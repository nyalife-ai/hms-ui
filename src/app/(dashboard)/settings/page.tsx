"use client";

import { Building2, MapPinned } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import { Card, CardHeader, PageHeader, PrimaryButton } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { buildListQuery, unwrapPage } from "@/lib/pagination";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type SettingItem = {
  key: string;
  label: string;
  value: string;
  type: string;
  groupName: string;
};

type SettingsResponse = {
  groups: Array<{ name: string; items: SettingItem[] }>;
};

type Section = "general" | "contact";

function itemsToMap(items: SettingItem[]): Record<string, SettingItem> {
  return Object.fromEntries(items.map((i) => [i.key, i]));
}

export default function SettingsPage() {
  const { user } = useAuth();
  const canEditSystem =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const [section, setSection] = useState<Section>("general");
  const [general, setGeneral] = useState<Record<string, SettingItem>>({});
  const [about, setAbout] = useState<Record<string, SettingItem>>({});
  const [contact, setContact] = useState<Record<string, SettingItem>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [consultOptions, setConsultOptions] = useState<
    Array<{ code: string; label: string; price: string }>
  >([]);

  useEffect(() => {
    if (!canEditSystem) return;
    let cancelled = false;
    (async () => {
      try {
        const qs = buildListQuery({ page: 1, limit: 200, search: "Consultation" });
        const res = unwrapPage<{
          serviceCode: string;
          serviceName: string;
          category: string | null;
          standardPrice: string;
          isActive: boolean;
        }>(await api(`/billing/services?${qs}`));
        if (cancelled) return;
        const options = res.items
          .filter(
            (r) =>
              r.isActive &&
              (r.serviceCode === "CONSULT" ||
                (r.category || "").toLowerCase().includes("consult")),
          )
          .map((r) => ({
            code: r.serviceCode,
            label: `${r.serviceCode} — ${r.serviceName} (KES ${Number(r.standardPrice).toLocaleString()})`,
            price: r.standardPrice,
          }));
        if (!options.some((o) => o.code === "CONSULT")) {
          try {
            const all = unwrapPage<{
              serviceCode: string;
              serviceName: string;
              standardPrice: string;
              isActive: boolean;
            }>(
              await api(
                `/billing/services?${buildListQuery({ page: 1, limit: 50, search: "CONSULT" })}`,
              ),
            );
            const consult = all.items.find((r) => r.serviceCode === "CONSULT");
            if (consult?.isActive) {
              options.unshift({
                code: consult.serviceCode,
                label: `${consult.serviceCode} — ${consult.serviceName} (KES ${Number(consult.standardPrice).toLocaleString()})`,
                price: consult.standardPrice,
              });
            }
          } catch {
            /* optional */
          }
        }
        setConsultOptions(options);
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canEditSystem]);

  useEffect(() => {
    if (!canEditSystem) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api<SettingsResponse>("/ops/settings");
        if (cancelled) return;
        const byGroup = Object.fromEntries(
          data.groups.map((g) => [g.name, itemsToMap(g.items)]),
        );
        setGeneral(byGroup.general ?? {});
        setAbout(byGroup.about ?? {});
        setContact(byGroup.contact ?? {});
        setError("");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load settings");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canEditSystem]);

  const workingDays = useMemo(() => {
    const raw = general.working_days?.value || "";
    return new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }, [general.working_days?.value]);

  const setValue = (
    group: "general" | "about" | "contact",
    key: string,
    value: string,
  ) => {
    const updater = (prev: Record<string, SettingItem>) => {
      const existing = prev[key];
      return {
        ...prev,
        [key]: {
          key,
          label: existing?.label || key,
          value,
          type: existing?.type || "string",
          groupName: existing?.groupName || group,
        },
      };
    };
    if (group === "general") setGeneral(updater);
    else if (group === "about") setAbout(updater);
    else setContact(updater);
  };

  const saveGroup = async (group: "general" | "contact") => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const items =
        group === "general"
          ? Object.values(general)
          : [
              ...Object.values(about),
              ...Object.values(contact),
            ];
      const data = await api<SettingsResponse>("/ops/settings", {
        method: "PUT",
        body: JSON.stringify({
          items: items.map((i) => ({
            key: i.key,
            value: i.value,
            label: i.label,
            type: i.type,
            groupName: i.groupName,
          })),
        }),
      });
      const byGroup = Object.fromEntries(
        data.groups.map((g) => [g.name, itemsToMap(g.items)]),
      );
      setGeneral(byGroup.general ?? {});
      setAbout(byGroup.about ?? {});
      setContact(byGroup.contact ?? {});
      setNotice(
        group === "general"
          ? "General settings saved."
          : "Contact settings saved.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setBusy(false);
    }
  };

  const onLogoFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Logo must be an image file.");
      return;
    }
    if (file.size > 700_000) {
      setError("Logo file is too large (max ~700KB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setValue("general", "logo", result);
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const renderField = (
    group: "general" | "about" | "contact",
    item: SettingItem | undefined,
    key: string,
    fallbackLabel: string,
  ) => {
    const label = item?.label || fallbackLabel;
    const value = item?.value ?? "";
    const isTextarea =
      key === "about_description" ||
      key === "contact_address" ||
      key === "hospital_address";
    const isColor = key === "primary_color" || key === "secondary_color";
    const isTime =
      key === "working_hours_start" || key === "working_hours_end";
    const isUrl =
      key === "contact_maps_url" ||
      key === "instagram_url" ||
      key === "linkedin_url";
    const isNumber = key === "tax_rate" || key === "appointment_interval";

    if (key === "logo") {
      return (
        <div key={key} className="space-y-2">
          <label className="text-sm font-medium text-slate-700">{label}</label>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Clinic logo"
              className="h-16 w-auto rounded-lg border border-slate-200 bg-white object-contain p-1"
            />
          ) : (
            <p className="text-xs text-slate-400">No logo uploaded yet.</p>
          )}
          <input
            type="file"
            accept="image/*"
            className="block w-full text-sm text-slate-600"
            onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)}
          />
        </div>
      );
    }

    if (key === "consultation_fee_enabled") {
      const on = value === "true" || value === "1" || value === "";
      return (
        <div key={key} className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">{label}</label>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">
                {on ? "Enabled — auto-invoice on cash check-in" : "Disabled — free consultation"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                When on, front desk check-in creates a draft consult fee and sends the patient to finance.
                Turn off for free-consultation days.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setValue("general", key, on ? "false" : "true")
              }
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                on
                  ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  : "bg-brand-500 text-white hover:bg-brand-600"
              }`}
            >
              {on ? "Disable" : "Enable"}
            </button>
          </div>
        </div>
      );
    }

    if (key === "consultation_fee_service_code") {
      return (
        <div key={key} className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">{label}</label>
          <select
            className={inputClass}
            value={value}
            onChange={(e) => setValue("general", key, e.target.value)}
          >
            <option value="">
              Auto (prefer Specialist Consultation 000-01. / Consultation category)
            </option>
            {consultOptions.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            Used when charging the triage consultation fee. Edit prices on Billing → Fee schedule.
          </p>
        </div>
      );
    }

    if (key === "working_days") {
      return (
        <div key={key} className="space-y-2">
          <label className="text-sm font-medium text-slate-700">{label}</label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => {
              const on = workingDays.has(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    const next = new Set(workingDays);
                    if (on) next.delete(day);
                    else next.add(day);
                    const ordered = WEEKDAYS.filter((d) => next.has(d));
                    setValue("general", "working_days", ordered.join(","));
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    on
                      ? "bg-brand-500 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-brand-50"
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (isTextarea) {
      return (
        <div key={key} className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">{label}</label>
          <textarea
            className={`${inputClass} min-h-28 resize-y`}
            value={value}
            onChange={(e) => setValue(group, key, e.target.value)}
          />
        </div>
      );
    }

    if (isColor) {
      return (
        <div key={key} className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">{label}</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={value || "#058b7c"}
              onChange={(e) => setValue(group, key, e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-slate-200 bg-white"
            />
            <input
              className={inputClass}
              value={value}
              onChange={(e) => setValue(group, key, e.target.value)}
            />
          </div>
        </div>
      );
    }

    const inputType = isNumber
      ? "number"
      : isTime
        ? "time"
        : isUrl
          ? "url"
          : "text";

    return (
      <div key={key} className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <input
          className={inputClass}
          type={inputType}
          value={
            isTime && value.length === 8 ? value.slice(0, 5) : value
          }
          onChange={(e) => {
            let next = e.target.value;
            if (isTime && /^\d{2}:\d{2}$/.test(next)) {
              next = `${next}:00`;
            }
            setValue(group, key, next);
          }}
          step={isNumber ? "1" : undefined}
        />
      </div>
    );
  };

  const generalKeys = [
    "hospital_name",
    "hospital_phone",
    "hospital_email",
    "hospital_address",
    "currency",
    "tax_rate",
    "appointment_interval",
    "consultation_fee_enabled",
    "consultation_fee_service_code",
    "working_days",
    "working_hours_start",
    "working_hours_end",
    "primary_color",
    "secondary_color",
    "logo",
  ];

  const contactKeys = [
    "about_description",
    "contact_address",
    "contact_email",
    "contact_phone",
    "contact_hours",
    "contact_maps_url",
    "instagram_url",
    "linkedin_url",
  ];

  return (
    <RoleGuard module="settings">
      <PageHeader title="Settings" subtitle="System configuration for NyaLife HMS" />

      <p className="mb-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
        Personal profile, password, and 2FA are under{" "}
        <Link href="/account" className="font-semibold text-brand-700 hover:underline">
          My Account
        </Link>
        .
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        {(
          [
            { id: "general" as const, label: "General", icon: Building2 },
            { id: "contact" as const, label: "Contact & about", icon: MapPinned },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setSection(tab.id);
              setNotice("");
              setError("");
            }}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
              section === tab.id
                ? "bg-brand-500 text-white"
                : "bg-white text-slate-500 shadow-sm hover:bg-brand-50 hover:text-brand-700"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {notice && (
        <p className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
          {notice}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </p>
      )}

      {section === "general" && canEditSystem && (
        <Card>
          <CardHeader
            title="General settings"
            subtitle="Facility identity, hours, billing defaults, and branding"
          />
          <div className="grid gap-4 px-5 pb-5 sm:max-w-2xl">
            {generalKeys.map((key) =>
              renderField("general", general[key], key, key),
            )}
            <PrimaryButton disabled={busy} onClick={() => void saveGroup("general")}>
              {busy ? "Saving…" : "Save general settings"}
            </PrimaryButton>
          </div>
        </Card>
      )}

      {section === "contact" && canEditSystem && (
        <Card>
          <CardHeader
            title="Contact & about"
            subtitle="Public clinic details, maps, and social links"
          />
          <div className="grid gap-4 px-5 pb-5 sm:max-w-2xl">
            {contactKeys.map((key) => {
              const group = key === "about_description" ? "about" : "contact";
              const item =
                key === "about_description" ? about[key] : contact[key];
              return renderField(group, item, key, key);
            })}
            <PrimaryButton disabled={busy} onClick={() => void saveGroup("contact")}>
              {busy ? "Saving…" : "Save contact settings"}
            </PrimaryButton>
          </div>
        </Card>
      )}
    </RoleGuard>
  );
}
