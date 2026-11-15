"use client";

import { useState } from "react";
import type { Account } from "@/lib/audit-schema";

type Plan = "monthly" | "yearly";

export function Paywall({ account, onClose }: { account: Account; onClose: () => void }) {
  const [plan, setPlan] = useState<Plan>(account.yearlyAvailable ? "yearly" : "monthly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error?.message);
      window.location.href = data.url;
    } catch (e) {
      setError((e instanceof Error && e.message) || "No se pudo iniciar el pago.");
      setBusy(false);
    }
  }

  const plans: { id: Plan; price: string; per: string; note: string }[] = [
    { id: "monthly", price: "0,50 €", per: "al mes", note: "Cancela cuando quieras" },
    ...(account.yearlyAvailable
      ? [{ id: "yearly" as Plan, price: "4,99 €", per: "al año", note: "Un solo pago al año" }]
      : []),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-rise w-full max-w-md rounded-t-3xl bg-card p-6 sm:rounded-3xl"
      >
        <h2 id="paywall-title" className="text-2xl font-black tracking-tight">
          Sigue auditando por menos que un café
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          {account.used >= account.limit && account.limit > 0
            ? `Has usado tus ${account.limit} auditorías gratis de este mes. `
            : ""}
          Con Pro tienes{" "}
          <strong className="text-ink">
            {account.proLimit === 0 ? "auditorías ilimitadas" : `${account.proLimit} auditorías al mes`}
          </strong>{" "}
          para contratos, facturas y presupuestos.
        </p>

        <div className="mt-5 grid gap-2" role="radiogroup" aria-label="Plan">
          {plans.map((p) => (
            <button
              key={p.id}
              role="radio"
              aria-checked={plan === p.id}
              onClick={() => setPlan(p.id)}
              className={`flex items-center justify-between rounded-2xl border-2 p-4 text-left transition ${
                plan === p.id ? "border-ink bg-paper" : "border-line"
              }`}
            >
              <span>
                <span className="text-xl font-bold">{p.price}</span>{" "}
                <span className="text-sm text-muted">{p.per}</span>
              </span>
              <span className="text-xs text-muted">{p.note}</span>
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-stop">{error}</p>}

        <button
          onClick={pay}
          disabled={busy}
          className="mt-5 h-14 w-full rounded-2xl bg-ink text-base font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? "Abriendo pago…" : "Desbloquear Pro"}
        </button>
        <p className="mt-3 text-center text-xs text-muted">
          {account.demoPayments
            ? "Modo demo: el pago está simulado, no se cobra nada."
            : "Pago seguro con Stripe."}
        </p>
        <button onClick={onClose} className="mt-2 w-full py-2 text-sm text-muted underline-offset-4 hover:underline">
          Ahora no
        </button>
      </div>
    </div>
  );
}
