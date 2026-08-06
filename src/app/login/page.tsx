"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { user, loginWithPassword, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("admin@nyalife.health");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await loginWithPassword(email.trim(), password);
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
            Sign in to NyaLife
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Use your work email and password.
          </p>

          <form onSubmit={(e) => void handlePasswordLogin(e)} className="mt-8 space-y-4 text-left">
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
                className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20"
              />
            </div>
            <div>
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="password"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20"
              />
            </div>

            {error && (
              <p className="text-xs font-medium text-rose-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
