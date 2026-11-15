import type { Audit } from "@/lib/audit-schema";

type Level = Audit["semaforo"];

const LAMPS: { level: Level; on: string; glow: string }[] = [
  { level: "rojo", on: "bg-stop", glow: "shadow-[0_0_48px_8px_rgba(220,38,38,0.65)]" },
  { level: "amarillo", on: "bg-warn", glow: "shadow-[0_0_48px_8px_rgba(234,179,8,0.65)]" },
  { level: "verde", on: "bg-go", glow: "shadow-[0_0_48px_8px_rgba(23,163,74,0.65)]" },
];

/** Semáforo. Sin `level`, las tres luces parpadean en secuencia (estado de carga). */
export function TrafficLight({ level }: { level?: Level }) {
  return (
    <div
      className="inline-flex items-center gap-3 rounded-full bg-ink p-3 sm:gap-4 sm:p-4"
      role="img"
      aria-label={level ? `Semáforo en ${level}` : "Analizando"}
    >
      {LAMPS.map((lamp, i) => {
        const active = lamp.level === level;
        return (
          <span
            key={lamp.level}
            style={level ? undefined : { animationDelay: `${i * 0.3}s` }}
            className={[
              "block rounded-full transition-all duration-500",
              level
                ? active
                  ? `size-24 sm:size-28 ${lamp.on} ${lamp.glow}`
                  : "size-10 bg-white/10 sm:size-12"
                : `size-12 ${lamp.on} animate-lamp`,
            ].join(" ")}
          />
        );
      })}
    </div>
  );
}
