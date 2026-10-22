/**
 * LocationSelectorDemo.tsx
 * Ejemplo completo de uso de LocationSelector con React Hook Form + Zod v4.
 */
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Send, FileText } from "lucide-react"
import LocationSelector from "./LocationSelector"
import { locationSchema } from "./locationSchema"

// ── Form schema ───────────────────────────────────────────────────────────────
const serviceFormSchema = z.object({
  titulo: z
    .string()
    .min(3, "El titulo debe tener al menos 3 caracteres.")
    .max(100),
  descripcion: z.string().min(10, "Describe el problema con al menos 10 caracteres."),
  location: locationSchema,
})

type ServiceFormValues = z.infer<typeof serviceFormSchema>

// ── Component ─────────────────────────────────────────────────────────────────
export default function LocationSelectorDemo() {
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
    watch,
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      titulo: "",
      descripcion: "",
      location: { lat: 0, lng: 0, address: "" },
    },
  })

  const locationValue = watch("location")

  const onSubmit = async (data: ServiceFormValues) => {
    console.log("Payload para el backend:", {
      titulo:      data.titulo,
      descripcion: data.descripcion,
      latitud:     data.location.lat,
      longitud:    data.location.lng,
      direccion:   data.location.address,
    })
    await new Promise((r) => setTimeout(r, 800))
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 16px", display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <FileText size={20} color="var(--accent)" />
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-light)" }}>
          Alta de Servicio Tecnico
        </h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor="titulo" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            TITULO DEL SERVICIO
          </label>
          <input
            id="titulo"
            {...register("titulo")}
            style={{
              padding: "11px 14px",
              background: "rgba(255,255,255,.04)",
              border: `1.5px solid ${errors.titulo ? "var(--danger)" : "rgba(255,255,255,.08)"}`,
              borderRadius: 10,
              color: "var(--text-light)",
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
            }}
            placeholder="Ej. Reparacion de fibra optica"
          />
          {errors.titulo && (
            <p style={{ color: "var(--danger)", fontSize: 11 }}>{errors.titulo.message}</p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor="descripcion" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            DESCRIPCION DEL PROBLEMA
          </label>
          <textarea
            id="descripcion"
            {...register("descripcion")}
            rows={3}
            style={{
              padding: "11px 14px",
              background: "rgba(255,255,255,.04)",
              border: `1.5px solid ${errors.descripcion ? "var(--danger)" : "rgba(255,255,255,.08)"}`,
              borderRadius: 10,
              color: "var(--text-light)",
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
              resize: "vertical",
            }}
            placeholder="Detalla el problema que presenta el cliente..."
          />
          {errors.descripcion && (
            <p style={{ color: "var(--danger)", fontSize: 11 }}>{errors.descripcion.message}</p>
          )}
        </div>

        {/* ─── LocationSelector ─── */}
        <LocationSelector
          name="location"
          control={control as unknown as import("react-hook-form").Control<import("react-hook-form").FieldValues>}
          setValue={setValue as unknown as import("react-hook-form").UseFormSetValue<import("react-hook-form").FieldValues>}
          errors={errors}
        />

        {locationValue.lat !== 0 && (
          <div style={{
            padding: "12px 16px",
            background: "rgba(0,212,161,.06)",
            border: "1px solid rgba(0,212,161,.2)",
            borderRadius: 10,
            fontSize: 12,
            color: "var(--text-muted)",
            lineHeight: 1.7,
          }}>
            <strong style={{ color: "var(--accent)" }}>Payload listo para el backend:</strong><br />
            <code style={{ color: "var(--text-light)", whiteSpace: "pre" }}>
              {JSON.stringify({ latitud: locationValue.lat, longitud: locationValue.lng, direccion: locationValue.address }, null, 2)}
            </code>
          </div>
        )}

        <button
          type="submit"
          id="btn-crear-servicio"
          disabled={isSubmitting}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "14px 28px",
            background: "var(--accent)",
            color: "#080d18",
            border: "none",
            borderRadius: 10,
            fontFamily: "inherit",
            fontWeight: 800,
            fontSize: 12,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            cursor: isSubmitting ? "not-allowed" : "pointer",
            opacity: isSubmitting ? .6 : 1,
            transition: "all .18s ease",
            alignSelf: "flex-end",
          }}
        >
          <Send size={14} />
          {isSubmitting ? "Enviando..." : "Crear Servicio"}
        </button>

        {isSubmitSuccessful && (
          <p style={{ color: "var(--accent)", fontSize: 13, fontWeight: 600 }}>
            Servicio creado (revisa la consola para el payload).
          </p>
        )}
      </form>
    </div>
  )
}
