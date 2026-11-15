"use client";

import { useState } from "react";
import type { Account } from "@/lib/audit-schema";
import {
  type Interval,
  LEAD_DISCOUNT_PERCENT,
  PACKS,
  PLANS,
  discountApplies,
  euros,
} from "@/lib/plans";
import { Modal } from "./Modal";

type Tab = "plans" | "packs";

export function Pricing({
  account,
  onClose,
  onLogin,
}: {
  account: Account;
  onClose: () => void;
  onLogin: () => void;
}) {
  const subscribed = account.plan !== "free";
  const [tab, setTab] = useState<Tab>(subscribed ? "packs" : "plans");
  const [interval, setInterval] = useState<Interval>("year");
  const [plan, setPlan] = useState("pro");
  const [pack, setPack] = useState("p25");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function buy() {
    if (!account.user) return onLogin();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(tab === "plans" ? { kind: "plan", plan, interval } : { kind: "pack", pack }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error?.message);
      window.location.href = data.url;
    } catch (e) {
      setError((e instanceof Error && e.message) || "No se pudo iniciar el pago.");
      setBusy(false);
    }
  }

  const option = (selected: boolean) =>
    `flex w-full items-center justify-between gap-3 rounded-2xl border-2 p-3.5 text-left transition ${
      selected ? "border-ink bg-paper" : "border-line"
    }`;
  const toggle = (on: boolean) =>
    `h-9 flex-1 rounded-full text-sm font-semibold transition ${on ? "bg-ink text-paper" : "text-muted"}`;

  return (
    <Modal title="Más auditorías, por céntimos" onClose={onClose}>
      <div className="mt-4 flex rounded-full bg-paper p-1" role="tablist">
        <button role="tab" aria-selected={tab === "plans"} onClick={() => setTab("plans")} className={toggle(tab === "plans")}>
          Suscripción
        </button>
        <button role="tab" aria-selected={tab === "packs"} onClick={() => setTab("packs")} className={toggle(tab === "packs")}>
          Packs sin suscripción
        </button>
      </div>

      {tab === "plans" ? (
        <>
          {subscribed ? (
            <p className="mt-4 rounded-xl bg-paper p-3 text-sm leading-relaxed">
              Ya tienes el plan <strong>{PLANS.find((p) => p.id === account.plan)?.name}</strong>. Para cambiar,
              cancélalo antes desde «Gestionar».
            </p>
          ) : (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm">
              <button onClick={() => setInterval("month")} className={interval === "month" ? "font-bold underline underline-offset-4" : "text-muted"}>
                Mensual
              </button>
              <span className="text-muted">·</span>
              <button onClick={() => setInterval("year")} className={interval === "year" ? "font-bold underline underline-offset-4" : "text-muted"}>
                Anual <span className="rounded-full bg-go/15 px-1.5 py-0.5 text-[11px] font-bold text-go">ahorra</span>
              </button>
            </div>
          )}
          <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Plan">
            {PLANS.map((p) => {
              const price = p[interval];
              const discounted = account.discount && discountApplies(price);
              return (
                <button
                  key={p.id}
                  role="radio"
                  aria-checked={plan === p.id}
                  disabled={subscribed}
                  onClick={() => setPlan(p.id)}
                  className={option(plan === p.id) + (subscribed ? " opacity-50" : "")}
                >
                  <span className="min-w-0">
                    <span className="block font-bold">
                      {p.name} · {p.audits} auditorías/mes
                    </span>
                    <span className="block text-xs text-muted">{p.tagline}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-bold tabular-nums">
                      {euros(discounted ? Math.round(price * (1 - LEAD_DISCOUNT_PERCENT / 100)) : price)}
                    </span>
                    <span className="block text-xs text-muted">
                      {discounted ? `1.ª cuota · luego ${euros(price)}` : interval === "year" ? "al año" : "al mes"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {account.discount && !subscribed && (
            <p className="mt-3 text-center text-xs text-go">
              🎁 Tu {LEAD_DISCOUNT_PERCENT} % de bienvenida ya está aplicado donde es posible.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Pago único. Las auditorías no caducan y se suman a las de tu plan.
          </p>
          <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Pack">
            {PACKS.map((p) => (
              <button key={p.id} role="radio" aria-checked={pack === p.id} onClick={() => setPack(p.id)} className={option(pack === p.id)}>
                <span>
                  <span className="block font-bold">{p.audits} auditorías</span>
                  <span className="block text-xs text-muted">{euros(Math.round(p.price / p.audits))} cada una</span>
                </span>
                <span className="font-bold tabular-nums">{euros(p.price)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {error && <p className="mt-3 text-sm text-stop">{error}</p>}

      {account.payments === "off" ? (
        <p className="mt-5 rounded-xl bg-paper p-3 text-center text-sm text-muted">
          Los pagos se activarán muy pronto.
        </p>
      ) : (
        <button
          onClick={buy}
          disabled={busy || (tab === "plans" && subscribed)}
          className="mt-5 h-14 w-full rounded-2xl bg-stop text-base font-bold text-white transition active:scale-[0.99] disabled:opacity-50"
        >
          {busy
            ? "Abriendo pago…"
            : !account.user
              ? "Entrar para continuar"
              : tab === "plans"
                ? "Suscribirme"
                : "Comprar pack"}
        </button>
      )}
      <p className="mt-3 text-center text-xs text-muted">
        {account.payments === "demo"
          ? "Modo demo: el pago está simulado, no se cobra nada."
          : "Pago seguro con Stripe. Cancela cuando quieras."}
      </p>
    </Modal>
  );
}
