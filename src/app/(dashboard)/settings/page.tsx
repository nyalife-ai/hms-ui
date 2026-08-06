"use client";

import { Building2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import { Card, CardHeader, PageHeader, PrimaryButton } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type HospitalSettings = {
  name: string;
  phone: string;
  email: string;
  address: string;
  timezone: string;
};

export default function SettingsPage() {
  const { changePassword } = useAuth();
  const [section, setSection] = useState<"hospital" | "security">("hospital");
  const [hospital, setHospital] = useState<HospitalSettings>({
    name: "NyaLife Health",
    phone: "",
    email: "",
    address: "",
    timezone: "Africa/Nairobi",
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<HospitalSettings>("/ops/settings/hospital");
        if (!cancelled) setHospital(data);
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveHospital = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await api<HospitalSettings>("/ops/settings/hospital", {
        method: "PATCH",
        body: JSON.stringify(hospital),
      });
      setHospital(data);
      setNotice("Hospital profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async () => {
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice("Password updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <RoleGuard module="settings">
      <PageHeader title="Settings" subtitle="System configuration for NyaLife HMS" />

      <div className="mb-5 flex gap-2">
        {[
          { id: "hospital" as const, label: "Hospital profile", icon: Building2 },
          { id: "security" as const, label: "Security & access", icon: ShieldCheck },
        ].map((tab) => (
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

      {notice && <p className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">{notice}</p>}
      {error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}

      {section === "hospital" && (
        <Card>
          <CardHeader
            title="Hospital profile"
            subtitle="Facility identity used on receipts and operational screens"
          />
          <div className="space-y-3 px-5 pb-5 sm:max-w-xl">
            <input
              className={inputClass}
              value={hospital.name}
              onChange={(e) => setHospital({ ...hospital, name: e.target.value })}
              placeholder="Facility name"
            />
            <input
              className={inputClass}
              value={hospital.phone}
              onChange={(e) => setHospital({ ...hospital, phone: e.target.value })}
              placeholder="Phone"
            />
            <input
              className={inputClass}
              value={hospital.email}
              onChange={(e) => setHospital({ ...hospital, email: e.target.value })}
              placeholder="Email"
            />
            <textarea
              className={`${inputClass} min-h-24 resize-y`}
              value={hospital.address}
              onChange={(e) => setHospital({ ...hospital, address: e.target.value })}
              placeholder="Address"
            />
            <input
              className={inputClass}
              value={hospital.timezone}
              onChange={(e) => setHospital({ ...hospital, timezone: e.target.value })}
              placeholder="Timezone"
            />
            <PrimaryButton disabled={busy} onClick={saveHospital}>
              {busy ? "Saving…" : "Save hospital profile"}
            </PrimaryButton>
          </div>
        </Card>
      )}

      {section === "security" && (
        <Card>
          <CardHeader
            title="Change password"
            subtitle="Updates the password for the signed-in administrator"
          />
          <div className="space-y-3 px-5 pb-5 sm:max-w-xl">
            <input
              className={inputClass}
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
            />
            <input
              className={inputClass}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
            />
            <input
              className={inputClass}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
            <PrimaryButton disabled={busy} onClick={savePassword}>
              {busy ? "Updating…" : "Update password"}
            </PrimaryButton>
          </div>
        </Card>
      )}
    </RoleGuard>
  );
}
