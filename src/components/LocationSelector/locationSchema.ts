/**
 * locationSchema.ts
 * Esquema Zod v4 para validar coordenadas y direccion textual
 * capturadas por LocationSelector.
 *
 * En Zod v4 los parametros de mensaje cambiaron:
 *   invalid_type_error -> error (o message)
 *   required_error     -> error (o message)
 */
import { z } from "zod"

// Lazaro Cardenas, Michoacan bounding box (aprox.)
const LAT_MIN = 17.7
const LAT_MAX = 18.2
const LNG_MIN = -102.45
const LNG_MAX = -101.9

export const locationSchema = z.object({
  lat: z
    .number({ error: "La latitud debe ser un numero." })
    .min(-90, "Latitud invalida (min -90)")
    .max(90,  "Latitud invalida (max 90)")
    .refine(
      (v) => v !== 0,
      "Debe seleccionar una ubicacion en el mapa."
    ),
  lng: z
    .number({ error: "La longitud debe ser un numero." })
    .min(-180, "Longitud invalida (min -180)")
    .max(180,  "Longitud invalida (max 180)")
    .refine(
      (v) => v !== 0,
      "Debe seleccionar una ubicacion en el mapa."
    ),
  address: z
    .string({ error: "La direccion es obligatoria." })
    .min(5, "La direccion debe tener al menos 5 caracteres.")
    .max(300, "La direccion no puede superar 300 caracteres."),
})

/** Schema relajado: acepta coordenadas globales sin restriccion de bounding box */
export const locationSchemaGlobal = locationSchema

/** Schema estricto: solo acepta ubicaciones dentro de la zona operativa */
export const locationSchemaOperativa = locationSchema.superRefine((val, ctx) => {
  if (val.lat < LAT_MIN || val.lat > LAT_MAX) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lat"],
      message: `Latitud fuera del area operativa (${LAT_MIN} - ${LAT_MAX}).`,
    })
  }
  if (val.lng < LNG_MIN || val.lng > LNG_MAX) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lng"],
      message: `Longitud fuera del area operativa (${LNG_MIN} - ${LNG_MAX}).`,
    })
  }
})

export type LocationInput = z.infer<typeof locationSchema>
