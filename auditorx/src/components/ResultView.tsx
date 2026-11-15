import type { Audit, Mode } from "@/lib/audit-schema";
import type { FeatureId } from "@/lib/plans";
import { ComingSoonButton } from "./ComingSoon";
import { TrafficLight } from "./TrafficLight";

/** Análisis a medio recibir: cualquier campo puede faltar todavía. */
export type PartialAudit = {
  semaforo?: string;
  tipo_documento?: string;
  veredicto?: string;
  puntos_criticos?: Partial<Audit["puntos_criticos"][number]>[];
  legal_vs_colado?: Partial<Audit["legal_vs_colado"][number]>[];
  plan_de_accion?: string[];
};

type Level = Audit["semaforo"];

const HEADLINE: Record<Level, { emoji: string; label: string; text: string }> = {
  verde: { emoji: "🟢", label: "Verde", text: "text-go" },
  amarillo: { emoji: "🟡", label: "Amarillo", text: "text-yellow-600" },
  rojo: { emoji: "🔴", label: "Rojo", text: "text-stop" },
};

const SEVERITY: Record<string, string> = {
  alta: "bg-stop/10 text-stop",
  media: "bg-warn/20 text-yellow-800",
  baja: "bg-go/10 text-go",
};

/** Textos y siguientes pasos según se audite un contrato o se revise un CV. */
const COPY: Record<Mode, { traps: string; versus: string; good: string; bad: string; next: FeatureId[] }> = {
  contrato: {
    traps: "Las 3 trampas o puntos críticos",
    versus: "Lo legal vs. lo que intentan colarte",
    good: "Lo legal",
    bad: "Lo que intentan",
    next: ["reclamacion", "seguimiento", "abogado", "comparador"],
  },
  revision: {
    traps: "Los 3 puntos débiles",
    versus: "Lo que buscan vs. lo que pone ahora",
    good: "Lo que buscan",
    bad: "Lo que pone ahora",
    next: ["reescribir", "ofertas", "entrevista", "seguimiento"],
  },
};

export function levelOf(audit: PartialAudit | null): Level | undefined {
  return audit?.semaforo && audit.semaforo in HEADLINE ? (audit.semaforo as Level) : undefined;
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="animate-rise rounded-2xl border border-line bg-card p-5 sm:p-6">
      <h2 className="mb-3 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-widest text-muted">
        <span className="tabular-nums text-ink">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ResultView({
  audit,
  mode,
  streaming,
  onReset,
  onFeature,
}: {
  audit: PartialAudit;
  mode: Mode;
  streaming: boolean;
  onReset: () => void;
  onFeature: (f: FeatureId) => void;
}) {
  const copy = COPY[mode];
  const level = levelOf(audit);
  const head = level ? HEADLINE[level] : null;
  const traps = (audit.puntos_criticos ?? []).filter((p) => p.titulo);
  const rows = (audit.legal_vs_colado ?? []).filter((r) => r.lo_legal);
  const steps = (audit.plan_de_accion ?? []).filter(Boolean);

  return (
    <div className="flex flex-col gap-4" aria-busy={streaming}>
      <header className="animate-rise flex flex-col items-center gap-4 pb-2 pt-4 text-center">
        <TrafficLight level={level} />
        {head && (
          <div>
            <p className={`text-5xl font-black tracking-tight sm:text-6xl ${head.text}`}>
              <span className="sr-only">{head.emoji} </span>
              {head.label}
            </p>
            <p className="mt-1 text-sm text-muted">{audit.tipo_documento}</p>
          </div>
        )}
      </header>

      {audit.veredicto && (
        <Section n={1} title="Veredicto rápido">
          <p className="text-lg font-medium leading-snug sm:text-xl">{audit.veredicto}</p>
        </Section>
      )}

      {traps.length > 0 && (
        <Section n={2} title={copy.traps}>
          <ol className="flex flex-col divide-y divide-line">
            {traps.map((p, i) => (
              <li key={i} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {p.titulo}
                    {p.gravedad && SEVERITY[p.gravedad] && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${SEVERITY[p.gravedad]}`}>
                        {p.gravedad}
                      </span>
                    )}
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
      )}

      {rows.length > 0 && (
        <Section n={3} title={copy.versus}>
          <div className="flex flex-col gap-3">
            {rows.map((row, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-go/10 p-3">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-go">{copy.good}</p>
                  <p className="text-[15px] leading-snug">{row.lo_legal}</p>
                </div>
                <div className="rounded-xl bg-stop/10 p-3">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stop">{copy.bad}</p>
                  <p className="text-[15px] leading-snug">{row.lo_que_intentan_colarte}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {steps.length > 0 && (
        <Section n={4} title="Plan de acción: qué hacer ahora mismo">
          <ol className="flex flex-col gap-2.5">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
                <span className="font-bold tabular-nums text-muted">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {streaming ? (
        <p className="animate-lamp py-2 text-center text-sm font-medium text-muted" role="status">
          Analizando letra pequeña…
        </p>
      ) : (
        <>
          <section className="animate-rise pt-2">
            <h2 className="mb-3 text-center text-sm font-bold">Da el siguiente paso</h2>
            <div className="mb-3">
              <ComingSoonButton feature="exportar" variant="hero" onOpen={onFeature} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {copy.next.map((f) => (
                <ComingSoonButton key={f} feature={f} variant="action" onOpen={onFeature} />
              ))}
            </div>
          </section>
          <button
            onClick={onReset}
            className="mt-2 h-14 rounded-2xl bg-ink text-base font-semibold text-white transition active:scale-[0.99]"
          >
            Auditar otro documento
          </button>
        </>
      )}
    </div>
  );
}
