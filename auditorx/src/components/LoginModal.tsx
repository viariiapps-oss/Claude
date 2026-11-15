"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import type { Account } from "@/lib/audit-schema";
import { Modal } from "./Modal";

export type AuthMode = "login" | "register";

const OAUTH = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
  { id: "apple", label: "Apple" },
] as const;

const MIN_PASSWORD = 8;

export function LoginModal({
  account,
  initialMode,
  onClose,
}: {
  account: Account;
  initialMode: AuthMode;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const has = (id: Account["providers"][number]) => account.providers.includes(id);
  const oauth = OAUTH.filter((p) => has(p.id));
  const registering = mode === "register";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (registering) {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error?.message || "No se pudo crear la cuenta.");
      }
      const res = await signIn("password", { email, password, redirect: false });
      if (res?.error) throw new Error("Correo o contraseña incorrectos.");
      window.location.reload();
    } catch (err) {
      setError((err instanceof Error && err.message) || "Algo ha fallado. Inténtalo de nuevo.");
      setBusy(false);
    }
  }

  async function magicLink() {
    if (!email) return setError("Escribe tu correo y te enviamos un enlace para entrar.");
    setBusy(true);
    setError("");
    const res = await signIn("email", { email, redirect: false, redirectTo: "/" });
    setBusy(false);
    if (res?.error) setError("No hemos podido enviar el enlace a ese correo.");
    else setSent(true);
  }

  const tab = (on: boolean) =>
    `h-9 flex-1 rounded-full text-sm font-semibold transition ${on ? "bg-ink text-white" : "text-muted"}`;
  const input = "h-12 rounded-xl border border-line bg-card px-4 outline-none focus:border-ink";

  if (account.providers.length === 0) {
    return (
      <Modal title="Cuentas" onClose={onClose}>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          El inicio de sesión todavía no está activado. Vuelve pronto.
        </p>
      </Modal>
    );
  }
  if (sent) {
    return (
      <Modal title="Revisa tu correo" onClose={onClose}>
        <p className="mt-3 text-[15px] leading-relaxed" role="status">
          Te hemos enviado un enlace a <strong>{email}</strong>. Ábrelo en este dispositivo para entrar.
        </p>
      </Modal>
    );
  }

  return (
    <Modal title={registering ? "Crea tu cuenta" : "Inicia sesión"} onClose={onClose}>
      <div className="mt-4 flex rounded-full bg-paper p-1" role="tablist">
        <button role="tab" aria-selected={!registering} onClick={() => { setMode("login"); setError(""); }} className={tab(!registering)}>
          Iniciar sesión
        </button>
        <button role="tab" aria-selected={registering} onClick={() => { setMode("register"); setError(""); }} className={tab(registering)}>
          Registrarse
        </button>
      </div>

      {oauth.length > 0 && (
        <>
          <div className="mt-5 flex flex-col gap-2">
            {oauth.map((p) => (
              <button
                key={p.id}
                onClick={() => signIn(p.id, { redirectTo: "/" })}
                className="h-12 rounded-xl border border-line bg-card font-semibold transition hover:bg-paper"
              >
                {registering ? "Registrarse" : "Continuar"} con {p.label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-center text-xs uppercase tracking-widest text-muted">o con tu correo</p>
        </>
      )}

      <form onSubmit={submit} className={`flex flex-col gap-2 ${oauth.length > 0 ? "mt-3" : "mt-5"}`}>
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="tu@correo.com"
          aria-label="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={input}
        />
        <input
          type="password"
          required
          minLength={registering ? MIN_PASSWORD : undefined}
          autoComplete={registering ? "new-password" : "current-password"}
          placeholder={registering ? `Contraseña (mínimo ${MIN_PASSWORD} caracteres)` : "Contraseña"}
          aria-label="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={input}
        />
        {error && (
          <p className="text-sm text-stop" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy} className="h-12 rounded-xl bg-ink font-semibold text-white disabled:opacity-60">
          {busy ? "Un momento…" : registering ? "Crear cuenta" : "Entrar"}
        </button>
      </form>

      {has("email") && !registering && (
        <button onClick={magicLink} disabled={busy} className="mt-3 w-full text-sm text-muted underline underline-offset-4">
          ¿Olvidaste la contraseña? Recibe un enlace para entrar
        </button>
      )}
      <p className="mt-4 text-center text-xs leading-relaxed text-muted">
        Con tu cuenta, tus auditorías y compras te siguen a cualquier dispositivo.
      </p>
    </Modal>
  );
}
