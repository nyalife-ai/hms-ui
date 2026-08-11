"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Step = "login" | "forgot" | "otp" | "reset" | "done";

const inputClass =
  "mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20";

export default function LoginPage() {
  const { user, loginWithPassword, loading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("super@nyalife.health");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  const clearAlerts = () => {
    setError("");
    setInfo("");
  };

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    clearAlerts();
    try {
      const outcome = await loginWithPassword(email.trim(), password);
      if (outcome.kind === "twoFactor") {
        const params = new URLSearchParams({
          hash: outcome.hash,
        });
        router.push(`/login/otp?${params.toString()}`);
        return;
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not reach the API. Is the backend running on port 4000?",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const sendForgotCode = async () => {
    setSubmitting(true);
    clearAlerts();
    try {
      const res = await api<{
        ok: boolean;
        message?: string;
        expiresInMinutes: number;
      }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setInfo(
        res.message ||
          `If an account exists, a ${res.expiresInMinutes}-minute code was sent.`,
      );
      setOtp("");
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    await sendForgotCode();
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    clearAlerts();
    try {
      const res = await api<{
        ok: boolean;
        resetToken: string;
        expiresInMinutes: number;
      }>("/auth/verify-reset-otp", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
      });
      setResetToken(res.resetToken);
      setNewPassword("");
      setConfirmPassword("");
      setInfo(`Code verified. Set a new password (expires in ${res.expiresInMinutes} min).`);
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    clearAlerts();
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          resetToken,
          newPassword,
        }),
      });
      setPassword("");
      setOtp("");
      setResetToken("");
      setInfo("Password updated. Sign in with your new password.");
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    step === "login"
      ? "Sign in to NyaLife"
      : step === "forgot"
        ? "Forgot password"
        : step === "otp"
          ? "Enter verification code"
          : step === "reset"
            ? "Set a new password"
            : "Password updated";

  const subtitle =
    step === "login"
      ? "Use your work email and password."
      : step === "forgot"
        ? "We will email a one-time code if the account exists."
        : step === "otp"
          ? `Enter the 6-digit code sent to ${email.trim() || "your email"}.`
          : step === "reset"
            ? "Choose a strong password you have not used before."
            : "You can now sign in with your new credentials.";

  return (
    <div className="flex min-h-screen bg-white">
      <div className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden bg-brand-50 p-12 lg:flex">
        <div className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-brand-100/50" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-brand-100/40" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <BrandLogo height={72} priority />
          <h1 className="mt-8 text-2xl font-bold tracking-tight text-brand-600">
            Stay on Top of Every Detail
          </h1>
          <p className="mt-3 max-w-sm text-sm text-slate-500">
            Sign in with your staff account.
          </p>
        </div>
        <p className="absolute bottom-6 text-xs text-slate-400">
          © 2026 NyaLife Health
        </p>
      </div>

      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-sm text-center lg:text-left">
          <div className="mb-6 flex justify-center lg:hidden">
            <BrandLogo height={48} priority />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {title}
          </h2>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>

          {step === "login" && (
            <form
              onSubmit={(e) => void handlePasswordLogin(e)}
              className="mt-8 space-y-4 text-left"
            >
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label
                    className="text-sm font-medium text-slate-700"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                    onClick={() => {
                      clearAlerts();
                      setStep("forgot");
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>

              {error && <p className="text-xs font-medium text-rose-500">{error}</p>}
              {info && <p className="text-xs font-medium text-emerald-600">{info}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
              >
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>
          )}

          {step === "forgot" && (
            <form
              onSubmit={(e) => void handleForgot(e)}
              className="mt-8 space-y-4 text-left"
            >
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="forgot-email">
                  Work email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              {error && <p className="text-xs font-medium text-rose-500">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Send verification code"}
              </button>
              <button
                type="button"
                className="w-full text-xs font-semibold text-slate-500 hover:text-slate-700"
                onClick={() => {
                  clearAlerts();
                  setStep("login");
                }}
              >
                Back to sign in
              </button>
            </form>
          )}

          {step === "otp" && (
            <form
              onSubmit={(e) => void handleVerifyOtp(e)}
              className="mt-8 space-y-4 text-left"
            >
              {info && <p className="text-xs font-medium text-emerald-600">{info}</p>}
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="otp">
                  6-digit code
                </label>
                <input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className={`${inputClass} tracking-[0.35em]`}
                  placeholder="••••••"
                />
              </div>
              {error && <p className="text-xs font-medium text-rose-500">{error}</p>}
              <button
                type="submit"
                disabled={submitting || otp.length !== 6}
                className="w-full rounded-full bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
              >
                {submitting ? "Verifying…" : "Verify code"}
              </button>
              <div className="flex justify-between text-xs font-semibold">
                <button
                  type="button"
                  className="text-slate-500 hover:text-slate-700"
                  onClick={() => {
                    clearAlerts();
                    setStep("forgot");
                  }}
                >
                  Change email
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  className="text-brand-600 hover:text-brand-700 disabled:opacity-50"
                  onClick={() => void sendForgotCode()}
                >
                  Resend code
                </button>
              </div>
            </form>
          )}

          {step === "reset" && (
            <form
              onSubmit={(e) => void handleReset(e)}
              className="mt-8 space-y-4 text-left"
            >
              {info && <p className="text-xs font-medium text-emerald-600">{info}</p>}
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="new-password">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  className="text-sm font-medium text-slate-700"
                  htmlFor="confirm-password"
                >
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              {error && <p className="text-xs font-medium text-rose-500">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Update password"}
              </button>
            </form>
          )}

          {step === "done" && (
            <div className="mt-8 space-y-4 text-left">
              {info && <p className="text-sm font-medium text-emerald-600">{info}</p>}
              <button
                type="button"
                className="w-full rounded-full bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
                onClick={() => {
                  clearAlerts();
                  setStep("login");
                }}
              >
                Continue to sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
