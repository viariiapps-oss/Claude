import type { Audit } from "@/lib/audit-schema";
import { TrafficLight } from "./TrafficLight";

const HEADLINE: Record<Audit["semaforo"], { emoji: string; label: string; text: string }> = {
  verde: { emoji: "🟢", label: "Verde", text: "text-go" },
  amarillo: { emoji: "🟡", label: "Amarillo", text: "text-yellow-600" },
  rojo: { emoji: "🔴", label: "Rojo", text: "text-stop" },
};

const SEVERITY: Record<Audit["puntos_criticos"][number]["gravedad"], string> = {
  alta: "bg-stop/10 text-stop",
  media: "bg-warn/20 text-yellow-800",
  baja: "bg-go/10 text-go",
};

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section
      className="animate-rise rounded-2xl border border-line bg-card p-5 sm:p-6"
      style={{ animationDelay: `${n * 80}ms` }}
    >
      <h2 className="mb-3 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-widest text-muted">
        <span className="tabular-nums text-ink">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ResultView({ audit, onReset }: { audit: Audit; onReset: () => void }) {
  const head = HEADLINE[audit.semaforo];
  return (
    <div className="flex flex-col gap-4">
      <header className="animate-rise flex flex-col items-center gap-4 pb-2 pt-4 text-center">
        <TrafficLight level={audit.semaforo} />
        <div>
          <p className={`text-5xl font-black tracking-tight sm:text-6xl ${head.text}`}>
            <span className="sr-only">{head.emoji} </span>
            {head.label}
          </p>
          <p className="mt-1 text-sm text-muted">{audit.tipo_documento}</p>
        </div>
      </header>

      <Section n={1} title="Veredicto rápido">
        <p className="text-lg font-medium leading-snug sm:text-xl">{audit.veredicto}</p>
      </Section>

      <Section n={2} title="Las 3 trampas o puntos críticos">
        <ol className="flex flex-col divide-y divide-line">
          {audit.puntos_criticos.map((p, i) => (
            <li key={i} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {p.titulo}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${SEVERITY[p.gravedad]}`}>
                    {p.gravedad}
                  </span>
                </p>
                <p className="mt-1 text-[15px] leading-relaxed text-ink/80">{p.explicacion}</p>
                {p.cita && (
                  <p className="mt-2 border-l-2 border-line pl-3 text-sm italic text-muted">{p.cita}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section n={3} title="Lo legal vs. lo que intentan colarte">
        <div className="flex flex-col gap-3">
          {audit.legal_vs_colado.map((row, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-go/10 p-3">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-go">Lo legal</p>
                <p className="text-[15px] leading-snug">{row.lo_legal}</p>
              </div>
              <div className="rounded-xl bg-stop/10 p-3">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stop">Lo que intentan</p>
                <p className="text-[15px] leading-snug">{row.lo_que_intentan_colarte}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section n={4} title="Plan de acción: qué hacer ahora mismo">
        <ol className="flex flex-col gap-2.5">
          {audit.plan_de_accion.map((step, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
              <span className="font-bold tabular-nums text-muted">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Section>

      <button
        onClick={onReset}
        className="mt-2 h-14 rounded-2xl bg-ink text-base font-semibold text-white transition active:scale-[0.99]"
      >
        Auditar otro documento
      </button>
    </div>
  );
}
