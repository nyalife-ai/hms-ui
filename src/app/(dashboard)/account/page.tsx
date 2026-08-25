"use client";

import {
  Bell,
  ShieldCheck,
  UserCircle,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { OtpInput } from "@/components/otp-input";
import { PushDeviceSettings } from "@/components/push-device-settings";
import { RoleGuard } from "@/components/role-guard";
import { Card, CardHeader, PageHeader, PrimaryButton } from "@/components/ui";
import {
  confirmTwoFactorChallenge,
  getMyProfile,
  startTwoFactorChallenge,
  updateMyProfile,
  uploadAvatar,
  useAuth,
  type MyProfile,
} from "@/lib/auth";
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/notifications";
import { unlockNotificationAudio } from "@/lib/notification-sound";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20";

type Tab = "profile" | "security" | "notifications";

export default function AccountPage() {
  const { user, changePassword, refreshMe } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [soundEnabled, setSoundEnabled] = useState(true);

  const [twoFactorModal, setTwoFactorModal] = useState<null | "enable" | "disable">(
    null,
  );
  const [tfChannel, setTfChannel] = useState<"email" | "sms">("email");
  const [tfHash, setTfHash] = useState("");
  const [tfOtp, setTfOtp] = useState("");
  const [tfMasked, setTfMasked] = useState("");
  const [tfStep, setTfStep] = useState<"channel" | "otp">("channel");
  const [tfCooldown, setTfCooldown] = useState(0);
  const [tfError, setTfError] = useState(false);

  const loadProfile = useCallback(async () => {
    const data = await getMyProfile();
    setProfile(data);
    setFirstName(data.firstName);
    setLastName(data.lastName);
    setPhone(data.phone ?? "");
    setSoundEnabled(data.notificationSoundEnabled);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void loadProfile().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Could not load profile");
      }
    });
    void fetchNotificationPreferences()
      .then((p) => {
        if (!cancelled) setSoundEnabled(p.notificationSoundEnabled);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, loadProfile]);

  useEffect(() => {
    if (tfCooldown <= 0) return;
    const t = window.setTimeout(() => setTfCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [tfCooldown]);

  const saveProfile = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await updateMyProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
      });
      setProfile(next);
      setNotice("Profile saved.");
      await refreshMe().catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  };

  const onAvatar = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Avatar must be an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Avatar must be 2MB or smaller.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await uploadAvatar(file);
      setProfile(next);
      setNotice("Avatar updated.");
      await refreshMe().catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload avatar");
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
      setNotice("Password updated. Please sign in again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
      setBusy(false);
    }
  };

  const toggleSound = async (enabled: boolean) => {
    unlockNotificationAudio();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const prefs = await updateNotificationPreferences({
        notificationSoundEnabled: enabled,
      });
      setSoundEnabled(prefs.notificationSoundEnabled);
      setNotice(
        prefs.notificationSoundEnabled
          ? "Notification sounds enabled."
          : "Notification sounds disabled. Alerts still appear silently.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update sound preference",
      );
    } finally {
      setBusy(false);
    }
  };

  const openTwoFactor = (intent: "enable" | "disable") => {
    setTwoFactorModal(intent);
    setTfChannel("email");
    setTfHash("");
    setTfOtp("");
    setTfMasked("");
    setTfStep("channel");
    setTfError(false);
    setTfCooldown(0);
    setError("");
    setNotice("");
  };

  const sendTwoFactorCode = async () => {
    if (!twoFactorModal) return;
    setBusy(true);
    setTfError(false);
    setError("");
    try {
      const res = await startTwoFactorChallenge({
        intent: twoFactorModal,
        channel: tfChannel,
      });
      setTfHash(res.hash);
      setTfMasked(res.maskedDestination);
      setTfStep("otp");
      setTfOtp("");
      setTfCooldown(30);
      setNotice(`Code sent to ${res.maskedDestination}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  };

  const confirmTwoFactor = async () => {
    if (!twoFactorModal || !tfHash) return;
    if (!/^\d{6}$/.test(tfOtp)) {
      setTfError(true);
      setError("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    setError("");
    setTfError(false);
    try {
      await confirmTwoFactorChallenge({
        hash: tfHash,
        otp: tfOtp,
        intent: twoFactorModal,
      });
      await refreshMe();
      setTwoFactorModal(null);
      setNotice(
        twoFactorModal === "enable"
          ? "Two-factor authentication enabled."
          : "Two-factor authentication disabled.",
      );
    } catch (err) {
      setTfError(true);
      setError(err instanceof Error ? err.message : "Could not verify code");
    } finally {
      setBusy(false);
    }
  };

  const twoFactorOn = Boolean(user?.twoFactorEnabled);

  return (
    <RoleGuard module="account">
      <PageHeader
        title="My Account"
        subtitle="Your profile, security, and personal notification preferences"
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {(
          [
            { id: "profile" as const, label: "Profile", icon: UserCircle },
            { id: "security" as const, label: "Security", icon: ShieldCheck },
            { id: "notifications" as const, label: "Notifications", icon: Bell },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              setNotice("");
              setError("");
            }}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === item.id
                ? "bg-brand-500 text-white"
                : "bg-white text-slate-500 shadow-sm hover:bg-brand-50 hover:text-brand-700"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
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

      {tab === "profile" && (
        <Card>
          <CardHeader
            title="Profile"
            subtitle="Update how your name and contact details appear"
          />
          <div className="grid gap-4 px-5 pb-5 sm:max-w-xl">
            <div className="flex items-center gap-4">
              {profile?.profileImage &&
              /^https?:\/\//i.test(profile.profileImage) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.profileImage}
                  alt=""
                  className="h-16 w-16 rounded-full object-cover ring-2 ring-slate-100"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-lg font-semibold text-brand-700">
                  {(firstName[0] || user?.name?.[0] || "?").toUpperCase()}
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Profile photo
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="mt-1 block w-full text-sm text-slate-600"
                  disabled={busy}
                  onChange={(e) => void onAvatar(e.target.files?.[0] ?? null)}
                />
                <p className="mt-1 text-xs text-slate-400">Max 2MB · JPEG, PNG, WebP, GIF</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  First name
                </label>
                <input
                  className={inputClass}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Last name
                </label>
                <input
                  className={inputClass}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Phone</label>
              <input
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254…"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                className={`${inputClass} bg-slate-50 text-slate-500`}
                value={profile?.email || user?.email || ""}
                disabled
                readOnly
              />
              <p className="text-xs text-slate-400">
                Email is managed by your administrator and cannot be changed here.
              </p>
            </div>
            <PrimaryButton disabled={busy} onClick={() => void saveProfile()}>
              {busy ? "Saving…" : "Save profile"}
            </PrimaryButton>
          </div>
        </Card>
      )}

      {tab === "security" && (
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Two-factor authentication"
              subtitle="Require a one-time code after password sign-in"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5 sm:max-w-xl">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {twoFactorOn ? "Enabled" : "Disabled"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Changing 2FA always requires verifying a code sent to you.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => openTwoFactor(twoFactorOn ? "disable" : "enable")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                  twoFactorOn
                    ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    : "bg-brand-500 text-white hover:bg-brand-600"
                }`}
              >
                {twoFactorOn ? "Disable 2FA" : "Enable 2FA"}
              </button>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Change password"
              subtitle="Updates the password for the signed-in account"
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
              <PrimaryButton disabled={busy} onClick={() => void savePassword()}>
                {busy ? "Updating…" : "Update password"}
              </PrimaryButton>
            </div>
          </Card>
        </div>
      )}

      {tab === "notifications" && (
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Notification sounds"
              subtitle="Controls audio only. Notifications still arrive when sound is off."
            />
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5 sm:max-w-xl">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Enable notification sounds
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {soundEnabled
                    ? "On — play a chime for new live alerts"
                    : "Off — silent alerts only"}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggleSound(!soundEnabled)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                  soundEnabled
                    ? "bg-brand-500 text-white hover:bg-brand-600"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {soundEnabled ? "On" : "Off"}
              </button>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Desktop / push alerts"
              subtitle="Register this browser for FCM push. Deny is fine — in-app alerts still work."
            />
            <PushDeviceSettings />
          </Card>
        </div>
      )}

      {twoFactorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tf-title"
            className="w-full max-w-md rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 id="tf-title" className="text-base font-semibold text-slate-900">
                  {twoFactorModal === "enable" ? "Enable" : "Disable"} two-factor
                  authentication
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {tfStep === "channel"
                    ? "Choose where to receive your verification code."
                    : `Enter the code sent to ${tfMasked}.`}
                </p>
              </div>
              <button
                type="button"
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                onClick={() => setTwoFactorModal(null)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {tfStep === "channel" ? (
                <>
                  <div className="flex gap-2">
                    {(["email", "sms"] as const).map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setTfChannel(ch)}
                        className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium capitalize transition ${
                          tfChannel === ch
                            ? "border-brand-500 bg-brand-50 text-brand-800"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                  <PrimaryButton
                    disabled={busy}
                    onClick={() => void sendTwoFactorCode()}
                  >
                    {busy ? "Sending…" : "Send code"}
                  </PrimaryButton>
                </>
              ) : (
                <>
                  <OtpInput
                    value={tfOtp}
                    onChange={setTfOtp}
                    disabled={busy}
                    error={tfError}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <PrimaryButton
                      disabled={busy || tfOtp.length !== 6}
                      onClick={() => void confirmTwoFactor()}
                    >
                      {busy ? "Verifying…" : "Confirm"}
                    </PrimaryButton>
                    <button
                      type="button"
                      disabled={busy || tfCooldown > 0}
                      onClick={() => void sendTwoFactorCode()}
                      className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      {tfCooldown > 0 ? `Resend in ${tfCooldown}s` : "Resend code"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
