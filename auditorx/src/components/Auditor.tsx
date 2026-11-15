"use client";

import { signOut } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Account,
  CATEGORY_LIST,
  type Category,
  GROUPS,
  type Group,
  modeOf,
} from "@/lib/audit-schema";
import { prepareImage } from "@/lib/image";
import { parsePartialJson } from "@/lib/partial-json";
import { type FeatureId, PLANS } from "@/lib/plans";
import { ComingSoonButton, ComingSoonModal } from "./ComingSoon";
import { LoginModal } from "./LoginModal";
import { Pricing } from "./Pricing";
import { type PartialAudit, ResultView, levelOf } from "./ResultView";
import { TrafficLight } from "./TrafficLight";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";
const MAX_BYTES = 10 * 1024 * 1024;
const LOADING_LINES = [
  "Analizando letra pequeña…",
  "Buscando costes ocultos…",
  "Comparando con lo que marca la ley…",
  "Preparando tu veredicto…",
];

type Phase = "idle" | "loading" | "result";
type Dialog = { kind: "pricing" } | { kind: "login" } | { kind: "soon"; feature: FeatureId } | null;

const LANDING_DOORS: FeatureId[] = ["seguimiento", "alertas", "historial", "familia"];
const RETURN_NOTICES: Record<string, string> = {
  plan: "¡Listo! Tu suscripción ya está activa.",
  pack: "¡Listo! Tus auditorías ya están en tu cuenta.",
  "0": "No se pudo confirmar el pago. Si te han cobrado, recarga la página en un minuto.",
};

export function Auditor() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [group, setGroup] = useState<Group>("Vivienda");
  const [category, setCategory] = useState<Category>("alquiler");
  const [audit, setAudit] = useState<PartialAudit | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [line, setLine] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    fetch("/api/me")
      .then((r) => r.json())
      .then((d: { account: Account }) => {
        setAccount(d.account);
        // Tras iniciar sesión para comprar, se vuelve a abrir la ventana de precios.
        if (d.account.user && sessionStorage.getItem("ax_after_login") === "pricing") {
          setDialog({ kind: "pricing" });
        }
        sessionStorage.removeItem("ax_after_login");
      })
      .catch(() => {});
    if (params.has("ok")) setNotice(RETURN_NOTICES[params.get("ok")!] ?? "");
    else if (params.get("login") === "sent") setNotice("Te hemos enviado un enlace de acceso. Revisa tu correo.");
    else if (params.has("error")) setError("No se pudo iniciar sesión. Inténtalo de nuevo.");
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (phase !== "loading") return;
    setLine(0);
    const t = setInterval(() => setLine((l) => Math.min(l + 1, LOADING_LINES.length - 1)), 2200);
    return () => clearInterval(t);
  }, [phase]);

  const pick = useCallback((f: File | undefined | null) => {
    if (!f) return;
    setError("");
    const ok = f.type === "application/pdf" || f.type.startsWith("image/");
    if (!ok) return setError("Formato no admitido. Sube un PDF o una imagen.");
    if (f.type === "application/pdf" && f.size > MAX_BYTES) return setError("El PDF supera los 10 MB.");
    setFile(f);
  }, []);

  const outOfQuota = account?.remaining === 0;
  const openPricing = () => setDialog({ kind: "pricing" });
  const openSoon = (feature: FeatureId) => setDialog({ kind: "soon", feature });

  async function submit() {
    if (!file) return;
    if (outOfQuota) return openPricing();
    setPhase("loading");
    setError("");
    setAudit(null);

    const stop = (message: string) => {
      setPhase("idle");
      setStreaming(false);
      setAudit(null);
      setError(message);
    };

    try {
      const body = new FormData();
      body.set("file", await prepareImage(file));
      body.set("category", category);
      const res = await fetch("/api/audit", { method: "POST", body });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        if (data.account) setAccount(data.account);
        if (data.error?.code === "quota_exceeded") {
          setPhase("idle");
          return openPricing();
        }
        return stop(data.error?.message || "Algo ha fallado. Inténtalo de nuevo.");
      }

      // El análisis llega en líneas JSON: trozos (`d`) y un evento final.
      setStreaming(true);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let pending = "";
      let json = "";
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += value;
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        let grew = false;
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line);
          if (event.d) {
            json += event.d;
            grew = true;
            continue;
          }
          if (event.account) setAccount(event.account);
          finished = true;
          if (event.error) {
            if (event.refund) {
              await fetch("/api/refund", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ token: event.refund }),
              }).catch(() => {});
            }
            return stop(event.error.message);
          }
          setAudit(event.audit);
          setPhase("result");
          setStreaming(false);
        }
        if (grew && !finished) {
          const partial = parsePartialJson(json) as PartialAudit | null;
          // No se enseña nada hasta saber el color: evita mostrar un documento ilegible.
          if (levelOf(partial)) {
            setAudit(partial);
            setPhase("result");
          }
        }
      }
      if (!finished) stop("La conexión se cortó a mitad del análisis. Inténtalo de nuevo.");
    } catch {
      stop("Sin conexión. Revisa tu red e inténtalo de nuevo.");
    }
  }

  async function manage() {
    const res = await fetch("/api/portal", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (data.url) window.location.href = data.url;
    else setError(data.error?.message || "No se pudo abrir la gestión de tu cuenta.");
  }

  function reset() {
    setAudit(null);
    setFile(null);
    setPhase("idle");
    window.scrollTo({ top: 0 });
  }

  const planName = PLANS.find((p) => p.id === account?.plan)?.name;

  return (
    <>
      <nav className="flex items-center justify-between gap-2">
        <span className="text-lg font-black tracking-tight">
          Auditor<span className="text-stop">X</span>
        </span>
        {account && (
          <div className="flex items-center gap-2">
            <button
              onClick={openPricing}
              className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium"
            >
              {planName && <span className="font-bold">{planName} · </span>}
              {account.remaining} {account.remaining === 1 ? "auditoría" : "auditorías"} ·{" "}
              <span className="font-semibold text-stop">Más</span>
            </button>
            {account.user ? (
              <details className="relative">
                <summary
                  aria-label="Tu cuenta"
                  className="flex size-8 cursor-pointer list-none items-center justify-center rounded-full bg-ink text-xs font-bold uppercase text-white [&::-webkit-details-marker]:hidden"
                >
                  {account.user.email[0]}
                </summary>
                <div className="absolute right-0 z-10 mt-2 w-56 rounded-2xl border border-line bg-card p-2 text-sm shadow-lg">
                  <p className="truncate px-3 py-2 text-xs text-muted">{account.user.email}</p>
                  {account.plan !== "free" && (
                    <button onClick={manage} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-paper">
                      Gestionar suscripción
                    </button>
                  )}
                  <button
                    onClick={() => signOut({ redirectTo: "/" })}
                    className="block w-full rounded-lg px-3 py-2 text-left hover:bg-paper"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </details>
            ) : (
              account.providers.length > 0 && (
                <button
                  onClick={() => setDialog({ kind: "login" })}
                  className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Entrar
                </button>
              )
            )}
          </div>
        )}
      </nav>

      {notice && (
        <p className="mt-4 rounded-xl bg-go/10 px-4 py-3 text-sm font-medium" role="status">
          {notice}
        </p>
      )}

      {phase === "result" && audit ? (
        <div className="mt-4">
          <ResultView audit={audit} mode={modeOf(category)} streaming={streaming} onReset={reset} onFeature={openSoon} />
        </div>
      ) : phase === "loading" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-24 text-center" aria-live="polite">
          <div className="relative">
            <TrafficLight />
          </div>
          <div className="relative h-28 w-20 overflow-hidden rounded-lg border-2 border-ink bg-card">
            <div className="flex flex-col gap-2 p-2.5">
              {[100, 80, 92, 60, 85, 70].map((w, i) => (
                <span key={i} className="h-1 rounded bg-line" style={{ width: `${w}%` }} />
              ))}
            </div>
            <span className="absolute inset-x-0 top-0 h-4 animate-scan bg-gradient-to-b from-transparent to-stop/40" />
          </div>
          <p className="text-xl font-semibold">{LOADING_LINES[line]}</p>
        </div>
      ) : (
        <>
          <header className="pb-6 pt-10 text-center sm:pt-14">
            <h1 className="text-balance text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
              Descubre las trampas ocultas <span className="text-stop">antes de firmar</span>
            </h1>
            <p className="mx-auto mt-4 max-w-md text-balance text-base text-muted sm:text-lg">
              Sube tu contrato, factura, presupuesto o currículum. En segundos sabrás si es verde, amarillo o rojo, y qué hacer.
            </p>
          </header>

          <div className="rounded-3xl border border-line bg-card p-4 shadow-sm sm:p-5">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pick(e.dataTransfer.files[0]);
              }}
              className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
                dragging ? "border-ink bg-paper" : "border-line"
              }`}
            >
              {file ? (
                <div className="flex items-center justify-between gap-3 text-left">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{file.name}</p>
                    <p className="text-sm text-muted">
                      {file.type === "application/pdf" ? "PDF" : "Imagen"} · {(file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <>
                  <p className="hidden font-medium sm:block">Arrastra aquí tu PDF o imagen</p>
                  <p className="hidden pb-3 pt-1 text-sm text-muted sm:block">o</p>
                  <div className="flex flex-col justify-center gap-2 sm:flex-row">
                    <button
                      onClick={() => fileInput.current?.click()}
                      className="h-12 rounded-xl bg-ink px-5 font-semibold text-white"
                    >
                      Elegir archivo
                    </button>
                    <button
                      onClick={() => cameraInput.current?.click()}
                      className="h-12 rounded-xl border border-line px-5 font-semibold"
                    >
                      Hacer foto
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-muted">PDF, JPG o PNG · máx. 10 MB</p>
                </>
              )}
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT}
                hidden
                onChange={(e) => {
                  pick(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <input
                ref={cameraInput}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => {
                  pick(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>

            <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-muted">¿Qué es?</p>
            <div className="mt-2 flex flex-wrap gap-1" role="tablist" aria-label="Apartado">
              {GROUPS.map((g) => (
                <button
                  key={g}
                  role="tab"
                  aria-selected={group === g}
                  onClick={() => {
                    setGroup(g);
                    setCategory(CATEGORY_LIST.find((c) => c.group === g)!.id);
                  }}
                  className={`h-9 rounded-full px-3 text-sm font-semibold transition ${
                    group === g ? "bg-ink text-white" : "text-muted hover:bg-paper"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de documento">
              {CATEGORY_LIST.filter((c) => c.group === group).map((c) => (
                <button
                  key={c.id}
                  role="radio"
                  aria-checked={category === c.id}
                  onClick={() => setCategory(c.id)}
                  className={`h-10 rounded-full px-4 text-sm font-medium transition ${
                    category === c.id ? "border-2 border-ink bg-paper font-semibold" : "border border-line bg-card"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {error && (
              <p className="mt-4 rounded-xl bg-stop/10 px-4 py-3 text-sm text-stop" role="alert">
                {error}
              </p>
            )}

            <button
              onClick={submit}
              disabled={!file}
              className="mt-4 h-14 w-full rounded-2xl bg-stop text-lg font-bold text-white transition active:scale-[0.99] disabled:bg-line disabled:text-muted"
            >
              Auditar documento
            </button>
            {outOfQuota && (
              <p className="mt-3 text-center text-sm text-muted">
                Te has quedado sin auditorías este mes.{" "}
                <button onClick={openPricing} className="font-semibold text-stop underline underline-offset-4">
                  Consigue más
                </button>
              </p>
            )}
          </div>

          <section className="mt-8">
            <h2 className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-muted">
              Próximamente en AuditorX
            </h2>
            <div className="flex flex-wrap justify-center gap-2">
              {LANDING_DOORS.map((f) => (
                <ComingSoonButton key={f} feature={f} onOpen={openSoon} />
              ))}
            </div>
          </section>
        </>
      )}

      {account && dialog?.kind === "pricing" && (
        <Pricing
          account={account}
          onClose={() => setDialog(null)}
          onLogin={() => {
            sessionStorage.setItem("ax_after_login", "pricing");
            setDialog({ kind: "login" });
          }}
        />
      )}
      {account && dialog?.kind === "login" && <LoginModal account={account} onClose={() => setDialog(null)} />}
      {dialog?.kind === "soon" && (
        <ComingSoonModal
          feature={dialog.feature}
          defaultEmail={account?.user?.email ?? ""}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
