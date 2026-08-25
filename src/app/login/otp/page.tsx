"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { useAuth } from "@/lib/auth";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20";

function LoginOtpForm() {
  const { user, loading, verifyLoginOtp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hash = searchParams.get("hash")?.trim() || "";

  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && !hash) {
      router.replace("/login");
    }
  }, [loading, hash, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!hash) {
      setError("Missing verification challenge. Sign in again.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await verifyLoginOtp(hash, otp.trim());
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invalid or expired verification code",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden bg-brand-50 p-12 lg:flex">
        <div className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-brand-100/50" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-brand-100/40" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <BrandLogo height={72} priority />
          <h1 className="mt-8 text-2xl font-bold tracking-tight text-brand-600">
            Two-step verification
          </h1>
          <p className="mt-3 max-w-sm text-sm text-foreground-light">
            Enter the code we sent to your email to finish signing in.
          </p>
        </div>
        <p className="absolute bottom-6 text-xs text-foreground-lighter">
          © 2026 NyaLife Health
        </p>
      </div>

      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-sm text-center lg:text-left">
          <div className="mb-6 flex justify-center lg:hidden">
            <BrandLogo height={48} priority />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Enter verification code
          </h2>
          <p className="mt-2 text-sm text-foreground-light">
            Check your email for a 6-digit sign-in code.
          </p>

          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="mt-8 space-y-4 text-left"
          >
            <div>
              <label className="text-sm font-medium text-foreground" htmlFor="login-otp">
                6-digit code
              </label>
              <input
                id="login-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className={`${inputClass} tracking-[0.35em]`}
                placeholder="••••••"
              />
            </div>
            {error && <p className="text-xs font-medium text-rose-500">{error}</p>}
            <button
              type="submit"
              disabled={submitting || otp.length !== 6 || !hash}
              className="w-full rounded-full bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
            >
              {submitting ? "Verifying…" : "Continue"}
            </button>
            <button
              type="button"
              className="w-full text-xs font-semibold text-foreground-light hover:text-foreground"
              onClick={() => router.push("/login")}
            >
              Back to sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-foreground-light">
          Loading…
        </div>
      }
    >
      <LoginOtpForm />
    </Suspense>
  );
}
