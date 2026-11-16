import { z } from "zod";
import type { Entrada } from "./types";

/** Validación de la entrada del motor cuando llega desde el navegador. */

const importe = z.number().finite().min(0).max(100_000_000);
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const discapacidad = z.enum(["ninguna", "33", "33_ayuda", "65"]);
const persona = z.object({ fechaNacimiento: fecha, discapacidad });

export const EntradaSchema = z.object({
  ejercicio: z.union([z.literal(2025), z.literal(2026)]),
  ccaa: z.enum([
    "andalucia", "aragon", "asturias", "baleares", "canarias", "cantabria", "castilla_la_mancha",
    "castilla_y_leon", "cataluna", "extremadura", "galicia", "madrid", "murcia", "la_rioja",
    "valencia", "ceuta", "melilla", "pais_vasco", "navarra",
  ]),
  modalidad: z.enum(["individual", "conjunta_matrimonio", "conjunta_monoparental"]),
  declarante: persona,
  conyuge: persona.optional(),
  descendientes: z.array(persona.extend({ compartido: z.boolean() })).max(20),
  ascendientes: z.array(persona.extend({ contribuyentesConDerecho: z.number().int().min(1).max(10) })).max(10),
  trabajo: z
    .array(
      z.object({
        id: z.string().max(80),
        titular: z.union([z.literal(0), z.literal(1)]),
        clase: z.enum(["salario", "desempleo", "pension"]),
        pagador: z.string().max(200),
        integro: importe,
        retencion: importe,
        cotizaciones: importe,
        fuente: z.string().max(300).optional(),
      }),
    )
    .max(40),
  cuotasSindicales: importe,
  defensaJuridica: importe,
  intereses: importe,
  dividendos: importe,
  retencionesCapital: importe,
  gananciasPatrimoniales: z.number().finite().min(-100_000_000).max(100_000_000),
  retencionesGanancias: importe,
  aportacionesPensiones: z.tuple([importe, importe]),
  donativos: importe,
  donativosRecurrentes: z.boolean(),
  inmuebles: z
    .array(z.object({ descripcion: z.string().max(80), valorCatastral: importe, revisado: z.boolean(), dias: z.number().int().min(0).max(365), porcentaje: z.number().gt(0).max(100) }))
    .max(20),
  alquileres: z
    .array(
      z.object({
        descripcion: z.string().max(80), ingresos: importe, interesesYReparacion: importe, otrosGastos: importe,
        costeAdquisicion: importe, valorCatastral: importe, valorCatastralConstruccion: importe,
        diasAlquilado: z.number().int().min(0).max(365), porcentaje: z.number().gt(0).max(100),
        reduccion: z.union([z.literal(0), z.literal(50), z.literal(60), z.literal(70), z.literal(90)]),
      }),
    )
    .max(20),
  trabajoEnCeutaMelilla: z.boolean(),
  maternidad: z.boolean(),
  familiaNumerosa: z.enum(["no", "general", "especial"]),
  hijosExcesoFamiliaNumerosa: z.number().int().min(0).max(20),
  familiaNumerosaCompartida: z.boolean(),
  requisitoDeduccionesFamiliares: z.boolean(),
  deduccionesAnticipadas: importe,
}) satisfies z.ZodType<Entrada>;
