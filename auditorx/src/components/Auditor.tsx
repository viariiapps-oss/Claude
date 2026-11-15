"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CATEGORIES, CATEGORY_LABELS, type Account, type Audit, type Category } from "@/lib/audit-schema";
import { prepareImage } from "@/lib/image";
import { Paywall } from "./Paywall";
import { ResultView } from "./ResultView";
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

export function Auditor() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<Category>("alquiler");
  const [audit, setAudit] = useState<Audit | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [line, setLine] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setAccount(d.account))
      .catch(() => {});
    const params = new URLSearchParams(window.location.search);
    if (params.has("pro")) {
      setNotice(
        params.get("pro") === "1"
          ? "¡Listo! Ya tienes AuditorX Pro."
          : "No se pudo confirmar el pago. Si te han cobrado, recarga la página en un minuto.",
      );
      window.history.replaceState(null, "", window.location.pathname);
    }
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

  const remaining = account && account.limit > 0 ? Math.max(0, account.limit - account.used) : null;
  const outOfQuota = remaining === 0;

  async function submit() {
    if (!file) return;
    if (outOfQuota && account && !account.pro) return setPaywall(true);
    setPhase("loading");
    setError("");
    try {
      const body = new FormData();
      body.set("file", await prepareImage(file));
      body.set("category", category);
      const res = await fetch("/api/audit", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (data.account) setAccount(data.account);
      if (!res.ok) {
        setPhase("idle");
        if (data.error?.code === "quota_exceeded" && !data.account?.pro) return setPaywall(true);
        return setError(data.error?.message || "Algo ha fallado. Inténtalo de nuevo.");
      }
      setAudit(data.audit);
      setPhase("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setPhase("idle");
      setError("Sin conexión. Revisa tu red e inténtalo de nuevo.");
    }
  }

  async function manage() {
    const res = await fetch("/api/portal", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (data.url) window.location.href = data.url;
  }

  function reset() {
    setAudit(null);
    setFile(null);
    setPhase("idle");
  }

  return (
    <>
      <nav className="flex items-center justify-between">
        <span className="text-lg font-black tracking-tight">
          Auditor<span className="text-stop">X</span>
        </span>
        {account &&
          (account.pro ? (
            <button onClick={manage} className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white">
              Pro · gestionar
            </button>
          ) : (
            <button
              onClick={() => setPaywall(true)}
              className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium"
            >
              {remaining} gratis · <span className="font-semibold">Hazte Pro</span>
            </button>
          ))}
      </nav>

      {notice && (
        <p className="mt-4 rounded-xl bg-go/10 px-4 py-3 text-sm font-medium" role="status">
          {notice}
        </p>
      )}

      {phase === "result" && audit ? (
        <div className="mt-4">
          <ResultView audit={audit} onReset={reset} />
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
              Sube tu contrato, factura o presupuesto. En segundos sabrás si es verde, amarillo o rojo, y qué hacer.
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

            <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de documento">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  role="radio"
                  aria-checked={category === c}
                  onClick={() => setCategory(c)}
                  className={`h-10 rounded-full px-4 text-sm font-medium transition ${
                    category === c ? "bg-ink text-white" : "border border-line bg-card"
                  }`}
                >
                  {CATEGORY_LABELS[c]}
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
            {outOfQuota && account?.pro && (
              <p className="mt-3 text-center text-sm text-muted">
                Has usado tus {account.limit} auditorías de este mes. Se renuevan el día 1.
              </p>
            )}
          </div>
        </>
      )}

      {paywall && account && <Paywall account={account} onClose={() => setPaywall(false)} />}
    </>
  );
}
