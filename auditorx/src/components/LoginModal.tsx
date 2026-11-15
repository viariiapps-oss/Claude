"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import type { Account } from "@/lib/audit-schema";
import { Modal } from "./Modal";

const OAUTH = [
  { id: "google", label: "Continuar con Google" },
  { id: "apple", label: "Continuar con Apple" },
  { id: "github", label: "Continuar con GitHub" },
] as const;

export function LoginModal({ account, onClose }: { account: Account; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const has = (id: Account["providers"][number]) => account.providers.includes(id);
  const emailProvider = has("email") ? "email" : has("demo") ? "demo" : null;

  async function withEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!emailProvider) return;
    setBusy(true);
    setError("");
    const res = await signIn(emailProvider, { email, redirect: false, redirectTo: "/" });
    if (res?.error) {
      setError("No hemos podido iniciar sesión con ese correo.");
      setBusy(false);
    } else if (emailProvider === "demo") {
      window.location.reload();
    } else {
      setSent(true);
    }
  }

  return (
    <Modal title="Entra o crea tu cuenta" onClose={onClose}>
      {account.providers.length === 0 ? (
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          El inicio de sesión todavía no está activado. Vuelve pronto.
        </p>
      ) : sent ? (
        <p className="mt-3 text-[15px] leading-relaxed" role="status">
          Te hemos enviado un enlace a <strong>{email}</strong>. Ábrelo en este dispositivo para entrar.
        </p>
      ) : (
        <>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Con tu cuenta, tus auditorías y compras te siguen a cualquier dispositivo.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            {OAUTH.filter((p) => has(p.id)).map((p) => (
              <button
                key={p.id}
                onClick={() => signIn(p.id, { redirectTo: "/" })}
                className="h-12 rounded-xl border border-line bg-card font-semibold transition hover:bg-paper"
              >
                {p.label}
              </button>
            ))}
          </div>
          {emailProvider && (
            <form onSubmit={withEmail} className="mt-4 flex flex-col gap-2">
              {account.providers.length > 1 && (
                <p className="text-center text-xs uppercase tracking-widest text-muted">o con tu correo</p>
              )}
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="tu@correo.com"
                aria-label="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl border border-line bg-card px-4 outline-none focus:border-ink"
              />
              <button
                disabled={busy}
                className="h-12 rounded-xl bg-ink font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Un momento…" : emailProvider === "demo" ? "Entrar (modo demo)" : "Enviarme un enlace"}
              </button>
            </form>
          )}
          {error && <p className="mt-3 text-sm text-stop">{error}</p>}
        </>
      )}
    </Modal>
  );
}
