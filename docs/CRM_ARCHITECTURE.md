# Arquitectura objetivo del CRM

## Decisiones de la Fase 0

La evolución del CRM será incremental. Las tablas actuales continúan atendiendo
producción mientras el nuevo modelo se valida en staging.

- `empresas_formales` conserva el flujo productivo existente.
- `crm_accounts` será la entidad canónica de empresa dentro del nuevo CRM.
- `crm_accounts.legacy_empresa_id` permite vincular ambos modelos sin imponer
  todavía una clave foránea sobre la tabla heredada.
- Empresa, prospección, actividad y oportunidad se modelan como conceptos
  diferentes.
- Los resultados de IA guardan estado, modelo, versión del prompt y confianza.
- Las actividades y los cambios de etapa son bitácoras append-only.
- Toda tabla expuesta al navegador usa RLS y privilegios mínimos.

## Dominios

### Empresa

`crm_accounts` contiene la identidad comercial, propietario, prioridad, etapa y
estado de enriquecimiento. `google_place_id` es el identificador de deduplicación
para candidatos obtenidos mediante Google Places.

### Prospección

`crm_prospecting_runs` representa una búsqueda completa. Cada Place encontrado
se registra en `crm_prospecting_candidates` y avanza independientemente por:

`pending -> processing -> enriched | retrying -> failed`

La migración no guarda la respuesta cruda de Google Places en los candidatos;
solo conserva el identificador y el resultado comercial generado.

### Operación comercial

- `crm_activities`: llamadas, visitas, reuniones, mensajes y notas.
- `crm_tasks`: próxima acción, vencimiento, prioridad y responsable.
- `crm_stage_history`: historial inmutable de cambios de pipeline.

### Oportunidades

`crm_opportunities` separa la oportunidad financiera del lead. El forecast se
calculará con monto y probabilidad reales, no con multiplicadores por tamaño.

## Pipeline inicial

Lead:

`Capturado -> Enriquecido -> Calificado -> Asignado -> Contactado -> Diagnóstico`

Oportunidad:

`Documentación -> Solicitud -> Estudio -> Aprobado -> Desembolsado`

Terminales:

`No elegible | Perdido | Duplicado | Sin respuesta`

## Compatibilidad temporal

Hasta terminar la migración funcional, la equivalencia con el estado heredado es:

| Estado actual | Nueva etapa |
| --- | --- |
| `nuevo` | `capturado` |
| `contactado` | `contactado` |
| `interesado` | `diagnostico` |
| `aprobado` | `aprobado` |
| `descartado` | `perdido` |

Desde la Fase 2, esta equivalencia alimenta un adaptador progresivo. Al abrir el
CRM se crean las cuentas profesionales faltantes y los cambios de etapa se
reflejan también en el estado heredado. Si el nuevo esquema no está disponible,
la interfaz vuelve automáticamente al CRM anterior.

## Próxima evolución

La Fase 3 incorpora Cloudflare Workflows como orquestador durable. Supabase es la
fuente de verdad del progreso y los resultados; el callback utiliza una
credencial aleatoria por ejecución y no requiere `service_role`.

1. Validar la prospección durable con búsquedas de alto volumen en producción.
2. Incorporar forecast financiero, SLA comercial y automatizaciones.
3. Añadir recuperación explícita de ejecuciones desde otros dispositivos.
4. Retirar el adaptador heredado solamente después de completar la migración de
   datos y aprobar una ventana formal de estabilización.
