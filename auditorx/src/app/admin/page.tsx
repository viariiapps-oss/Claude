"use client";

import { useEffect, useState } from "react";

type Report = {
  features: { id: string; label: string; clicks: number; emails: number; choices?: Record<string, number> }[];
  leads: { email: string; features: string[]; at: string; used: boolean }[];
};

/** Panel privado: interés por cada función «próximamente» y correos recogidos. */
export default function Admin() {
  const [key, setKey] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  // null = comprobando; false = este visitante no es el dueño
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/admin/leads")
      .then((r) => setAllowed(r.status !== 404))
      .catch(() => setAllowed(false));
  }, []);

  async function load(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/leads", { headers: { authorization: `Bearer ${key}` } });
    if (!res.ok) return setError("Clave incorrecta.");
    setReport(await res.json());
  }

  async function downloadCsv() {
    const res = await fetch("/api/admin/leads?format=csv", { headers: { authorization: `Bearer ${key}` } });
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: "auditorx-correos.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }

  const cell = "border-b border-line px-3 py-2 text-left";

  if (allowed === null) return null;
  if (!allowed) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-black tracking-tight">Página no encontrada</h1>
        <a href="/" className="mt-4 text-sm underline underline-offset-4">
          Volver a AuditorX
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-black tracking-tight">Interesados</h1>

      {!report ? (
        <form onSubmit={load} className="mt-6 flex max-w-sm flex-col gap-2">
          <input
            type="password"
            required
            placeholder="Clave de administración (ADMIN_SECRET)"
            aria-label="Clave de administración"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="h-12 rounded-xl border border-line bg-card px-4 outline-none focus:border-ink"
          />
          <button className="h-12 rounded-xl bg-ink font-semibold text-white">Ver datos</button>
          {error && <p className="text-sm text-stop">{error}</p>}
        </form>
      ) : (
        <>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-widest text-muted">Por función</h2>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-line bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-muted">
                  <th className={cell}>Función</th>
                  <th className={cell}>Clics</th>
                  <th className={cell}>Correos</th>
                  <th className={cell}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {[...report.features]
                  .sort((a, b) => b.clicks - a.clicks)
                  .map((f) => (
                    <tr key={f.id}>
                      <td className={cell + " font-medium"}>{f.label}</td>
                      <td className={cell + " tabular-nums"}>{f.clicks}</td>
                      <td className={cell + " tabular-nums"}>{f.emails}</td>
                      <td className={cell + " text-muted"}>
                        {f.choices
                          ? Object.entries(f.choices)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ")
                          : ""}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
              Correos ({report.leads.length})
            </h2>
            <button onClick={downloadCsv} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
              Descargar CSV
            </button>
          </div>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-line bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-muted">
                  <th className={cell}>Correo</th>
                  <th className={cell}>Funciones</th>
                  <th className={cell}>Fecha</th>
                  <th className={cell}>Descuento</th>
                </tr>
              </thead>
              <tbody>
                {report.leads.map((l) => (
                  <tr key={l.email}>
                    <td className={cell + " font-medium"}>{l.email}</td>
                    <td className={cell}>{l.features.join(", ")}</td>
                    <td className={cell + " tabular-nums"}>{l.at.slice(0, 10)}</td>
                    <td className={cell}>{l.used ? "usado" : "pendiente"}</td>
                  </tr>
                ))}
                {report.leads.length === 0 && (
                  <tr>
                    <td className={cell + " text-muted"} colSpan={4}>
                      Todavía no hay correos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
