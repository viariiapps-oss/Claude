"use client";

import { useEffect, useState } from "react";
import type { Account } from "@/lib/audit-schema";
import { PLANS } from "@/lib/plans";
import { type Prefs, loadPrefs, savePrefs } from "@/lib/prefs";
import { Modal } from "./Modal";

export type SettingsTab = "interface" | "billing";

const THEMES: { id: Prefs["theme"]; label: string }[] = [
  { id: "system", label: "Automático" },
  { id: "light", label: "Claro" },
  { id: "dark", label: "Oscuro" },
];
const SIZES: { id: Prefs["size"]; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "large", label: "Grande" },
];

function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mt-5">
      <p className="text-sm font-semibold">{label}</p>
      <div className="mt-2 flex gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`h-11 flex-1 rounded-full text-sm font-semibold transition ${
              value === o.id ? "bg-ink text-paper" : "border border-line"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Settings({
  account,
  initialTab,
  onClose,
  onPricing,
}: {
  account: Account;
  initialTab: SettingsTab;
  onClose: () => void;
  onPricing: () => void;
}) {
  const [tab, setTab] = useState<SettingsTab>(account.user ? initialTab : "interface");
  const [prefs, setPrefs] = useState<Prefs>({ theme: "system", size: "normal" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setPrefs(loadPrefs()), []);

  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
  };

  async function openPortal() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/portal", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (data.url) window.location.href = data.url;
    else {
      setError(data.error?.message || "No se pudo abrir la gestión de pagos.");
      setBusy(false);
    }
  }

  const plan = PLANS.find((p) => p.id === account.plan);
  const tabClass = (on: boolean) =>
    `h-9 flex-1 rounded-full text-sm font-semibold transition ${on ? "bg-ink text-paper" : "text-muted"}`;
  const row = "flex items-baseline justify-between gap-4 border-b border-line py-3 text-[15px]";

  return (
    <Modal title="Ajustes" onClose={onClose}>
      {account.user && (
        <div className="mt-4 flex rounded-full bg-paper p-1" role="tablist">
          <button role="tab" aria-selected={tab === "interface"} onClick={() => setTab("interface")} className={tabClass(tab === "interface")}>
            Interfaz
          </button>
          <button role="tab" aria-selected={tab === "billing"} onClick={() => setTab("billing")} className={tabClass(tab === "billing")}>
            Plan y pagos
          </button>
        </div>
      )}

      {tab === "interface" ? (
        <>
          <Choice label="Tema" options={THEMES} value={prefs.theme} onChange={(theme) => update({ theme })} />
          <Choice label="Tamaño del texto" options={SIZES} value={prefs.size} onChange={(size) => update({ size })} />
          <p className="mt-5 text-xs leading-relaxed text-muted">
            Estos ajustes se guardan en este dispositivo.
          </p>
        </>
      ) : (
        <>
          <dl className="mt-4">
            <div className={row}>
              <dt className="text-muted">Cuenta</dt>
              <dd className="truncate font-medium">{account.user?.email}</dd>
            </div>
            <div className={row}>
              <dt className="text-muted">Plan</dt>
              <dd className="font-medium">{plan ? `${plan.name} · ${plan.audits} auditorías/mes` : "Gratis"}</dd>
            </div>
            <div className={row}>
              <dt className="text-muted">Usadas este mes</dt>
              <dd className="font-medium tabular-nums">
                {account.used} de {account.limit}
              </dd>
            </div>
            <div className={row}>
              <dt className="text-muted">Auditorías de packs</dt>
              <dd className="font-medium tabular-nums">{account.credits}</dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-col gap-2">
            <button onClick={onPricing} className="h-12 rounded-xl bg-ink font-semibold text-paper">
              {plan ? "Comprar un pack de auditorías" : "Ver planes y packs"}
            </button>
            {account.payments !== "off" && (
              <button
                onClick={openPortal}
                disabled={busy}
                className="h-12 rounded-xl border border-line font-semibold disabled:opacity-60"
              >
                {busy ? "Abriendo…" : plan ? "Gestionar o cancelar suscripción" : "Métodos de pago y facturas"}
              </button>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-stop">{error}</p>}
          <p className="mt-4 text-xs leading-relaxed text-muted">
            {account.payments === "off"
              ? "Los pagos se activarán muy pronto."
              : "Cambiar la tarjeta, descargar facturas o cancelar se hace en el portal seguro de Stripe."}
          </p>
        </>
      )}
    </Modal>
  );
}
