# Runbook de la Fase 2: CRM operativo

## Resultado funcional

La pestaña CRM incorpora un modo profesional con:

- tablero Kanban y vista de lista por pipeline;
- ficha Lead 360 con datos comerciales y contacto principal;
- contactos asociados a cada empresa;
- tareas con prioridad, vencimiento y finalización;
- actividades y timeline de cambios de etapa;
- indicadores de cuentas activas, tareas abiertas, vencidas y sin próxima acción.

La adopción es gradual. Si las tablas del nuevo CRM no existen o todavía no son
accesibles, la interfaz carga automáticamente el CRM heredado. No se altera el
flujo de mapas, prospección, enriquecimiento con IA ni autenticación.

## Orden de despliegue

1. Tomar un respaldo o snapshot del proyecto Supabase.
2. Aplicar y validar primero `20260716000100_crm_foundation.sql`.
3. Aplicar `20260717000100_crm_operational.sql`.
4. Ejecutar las pruebas pgTAP en una instancia local o de staging.
5. Probar con un asesor: abrir CRM, mover una empresa, crear contacto, actividad
   y tarea, y finalizar la tarea.
6. Verificar que el estado heredado también se actualiza al mover una tarjeta.
7. Revisar RLS y Security Advisor antes de promover a producción.
8. Publicar el frontend únicamente después de aprobar la migración en staging.

## Seguridad y auditoría

- Los contactos heredan el aislamiento por propietario de la empresa.
- El navegador no puede insertar manualmente historial de etapas.
- El historial se registra mediante trigger al cambiar `stage_id`.
- Finalizar una tarea normaliza `completed_at` y genera una actividad auditable.
- Actividades e historial continúan siendo append-only para usuarios autenticados.

## Compatibilidad de datos

Al abrir el CRM, el adaptador crea únicamente las cuentas profesionales que
faltan, vinculadas por `legacy_empresa_id`. No duplica cuentas existentes. Un
cambio de etapa se persiste primero en el modelo profesional y luego se refleja
en `empresas_formales.crm_status` mediante la API ya utilizada por la web.

## Validación local

```text
npm run lint
npm run build
npx supabase db start
npx supabase test db
```

Las pruebas locales no deben ejecutarse contra producción.

## Reversión segura

Si el esquema nuevo presenta un incidente, no se deben eliminar tablas ni datos.
La aplicación vuelve al CRM heredado cuando las tablas no están disponibles. La
corrección debe hacerse con una migración posterior y probarse primero en staging.
