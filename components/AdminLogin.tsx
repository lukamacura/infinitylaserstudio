"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";

interface AdminLoginProps {
  icon: LucideIcon;
  onSignIn: (password: string) => Promise<string | null>;
  /** Still checking a saved session - show a spinner instead of the form. */
  checking?: boolean;
}

/** Shared password screen for /admin, /finances and /stats. */
export default function AdminLogin({ icon: Icon, onSignIn, checking }: AdminLoginProps) {
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setError(await onSignIn(password));
    } catch {
      setError("Prijava nije uspela. Proverite internet konekciju.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-linear-to-br from-[#0D1117] to-[#1A2332] flex items-center justify-center p-4">
      <style jsx global>{` .animate-promo-in { display: none !important; } `}</style>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 md:p-12">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-teal to-pink flex items-center justify-center shadow-lg shadow-teal/20">
            <Icon size={32} className="text-white" />
          </div>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold font-playfair mb-2">Admin Panel</h1>
          <p className="text-[10px] text-foreground/30 font-bold font-poppins uppercase tracking-[0.2em]">Infinity Laser Studio</p>
        </div>

        {checking ? (
          <div className="flex justify-center py-6">
            <Loader2 size={24} className="animate-spin text-foreground/30" />
          </div>
        ) : (
          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            <div className="space-y-2">
              <label className="hidden md:block text-[10px] font-bold tracking-[0.2em] text-foreground/30 font-poppins uppercase px-1">Lozinka</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder="Unesite lozinku"
                autoFocus
                className={`w-full px-5 py-4 rounded-2xl border-2 font-poppins text-sm focus:outline-none transition-all ${
                  error ? "border-red-400 bg-red-50" : "border-foreground/5 bg-foreground/2 focus:border-teal/50 focus:bg-white"
                }`}
              />
              {error && <p className="text-[11px] text-red-500 font-poppins font-medium mt-1.5 ml-1">{error}</p>}
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-4.5 rounded-2xl bg-linear-to-r from-teal to-[#14B8A6] text-white text-xs font-bold tracking-[0.2em] font-poppins cursor-pointer active:scale-[0.98] transition-all shadow-lg shadow-teal/10 disabled:opacity-60"
            >
              {busy ? "PRIJAVA…" : "PRIJAVA"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
