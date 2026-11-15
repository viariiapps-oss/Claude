"use client";

import { useEffect, useState } from "react";
import { COMING_SOON, type FeatureId, LEAD_DISCOUNT_PERCENT } from "@/lib/plans";
import { Modal } from "./Modal";

/** Botón llamativo de una función que aún no existe; abre el aviso al pulsarlo. */
export function ComingSoonButton({
  feature,
  onOpen,
  variant = "chip",
}: {
  feature: FeatureId;
  onOpen: (f: FeatureId) => void;
  variant?: "chip" | "action";
}) {
  const f = COMING_SOON[feature];
  return (
    <button
      onClick={() => onOpen(feature)}
      className={
        variant === "action"
          ? "group relative flex items-center gap-3 rounded-2xl border-2 border-ink bg-card p-4 text-left font-semibold shadow-[4px_4px_0_0_var(--color-ink)] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--color-stop)] active:translate-y-0"
          : "relative flex items-center gap-2 rounded-full border-2 border-ink bg-card py-2 pl-3 pr-4 text-sm font-semibold transition hover:-translate-y-0.5 hover:bg-warn/30"
      }
    >
      <span className={variant === "action" ? "text-2xl" : "text-base"} aria-hidden>
        {f.icon}
      </span>
      <span className="min-w-0 flex-1">{f.label}</span>
      <span className="rounded-full bg-stop px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
        Nuevo
      </span>
    </button>
  );
}

/** Aviso honesto: la función está en construcción; correo a cambio de descuento. */
export function ComingSoonModal({
  feature,
  defaultEmail,
  onClose,
}: {
  feature: FeatureId;
  defaultEmail: string;
  onClose: () => void;
}) {
  const f = COMING_SOON[feature];
  const [email, setEmail] = useState(defaultEmail);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");

  // Registrar el clic es lo que mide el interés por cada función.
  useEffect(() => {
    fetch("/api/interest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ feature }),
    }).catch(() => {});
  }, [feature]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError("");
    try {
      const res = await fetch("/api/interest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ feature, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message);
      setState("done");
    } catch (err) {
      setError((err instanceof Error && err.message) || "No se pudo guardar. Inténtalo de nuevo.");
      setState("idle");
    }
  }

  return (
    <Modal title={`🚧 ${f.label}: en construcción`} onClose={onClose}>
      {state === "done" ? (
        <div role="status">
          <p className="mt-3 text-[15px] leading-relaxed">
            ¡Apuntado! Te escribiremos a <strong>{email}</strong> en cuanto esté lista.
          </p>
          <p className="mt-3 rounded-xl bg-go/10 p-3 text-[15px] leading-relaxed">
            Tu <strong>{LEAD_DISCOUNT_PERCENT} % de descuento</strong> se aplicará solo al suscribirte con una
            cuenta que use ese mismo correo.
          </p>
          <button onClick={onClose} className="mt-5 h-12 w-full rounded-xl bg-ink font-semibold text-white">
            Entendido
          </button>
        </div>
      ) : (
        <>
          <p className="mt-3 text-[15px] leading-relaxed">{f.blurb}</p>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Todavía no está disponible: la estamos construyendo. Déjanos tu correo, te contamos más y te
            avisamos cuando salga.
          </p>
          <p className="mt-4 rounded-xl bg-warn/25 p-3 text-[15px] font-medium leading-snug">
            🎁 De regalo, un {LEAD_DISCOUNT_PERCENT} % de descuento en tu primera suscripción.
          </p>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
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
              disabled={state === "busy"}
              className="h-12 rounded-xl bg-stop font-bold text-white disabled:opacity-60"
            >
              {state === "busy" ? "Guardando…" : `Avisadme y guardar mi ${LEAD_DISCOUNT_PERCENT} %`}
            </button>
          </form>
          {error && <p className="mt-3 text-sm text-stop">{error}</p>}
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Usaremos tu correo solo para hablarte de esta función y enviarte el descuento. El descuento no se
            aplica al plan Pro mensual, que ya está en el cobro mínimo (0,50 €).
          </p>
        </>
      )}
    </Modal>
  );
}
