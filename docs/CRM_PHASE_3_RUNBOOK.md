# Runbook de la Fase 3: prospección durable

## Resultado funcional

El enriquecimiento de prospectos deja de depender de una única petición HTTP.
Cada búsqueda crea una ejecución de Cloudflare Workflows que:

- divide los prospectos en minilotes de cuatro para evitar respuestas truncadas;
- prueba hasta tres modelos gratuitos de forma explícita y conserva respuestas parciales;
- limita cada intento a 80 segundos y evita esperas exponenciales prolongadas;
- persiste cada lote en Supabase antes de avanzar;
- conserva resultados exitosos aunque otro lote falle;
- expone progreso por ejecución al usuario;
- finaliza como `completed` o `partial` según los resultados;
- activa el endpoint síncrono anterior como recuperación compatible.

## Componentes

- `ProspectingWorkflow`: orquesta análisis, reintentos y persistencia.
- `POST /api/prospecting/start`: autentica, limita y crea la ejecución.
- `GET /api/prospecting/:runId`: devuelve progreso y resultados bajo RLS.
- `crm_create_prospecting_run`: crea run y candidatos atómicamente.
- `crm_record_prospecting_batch`: registra avances idempotentes mediante una
  credencial aleatoria exclusiva de la ejecución.

La credencial del Workflow nunca se entrega al navegador. Supabase conserva
solamente su hash SHA-256 y rechaza actualizaciones con una credencial distinta.

## Despliegue

1. Aplicar `20260717000200_crm_durable_prospecting.sql` en Supabase.
2. Ejecutar `npx supabase test db` en local o staging.
3. Ejecutar `npm run generate-types`, `npm run lint` y `npm run build`.
4. Ejecutar `wrangler deploy --dry-run` y confirmar que aparecen los bindings:
   `CRM_PROSPECTING_WORKFLOW` y `CRM_WORKFLOW_RATE_LIMITER`.
5. Verificar que Cloudflare conserva los secrets actuales:
   `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `SUPABASE_URL`, `SUPABASE_KEY` y
   `APP_URL`.
6. Desplegar primero en staging cuando exista ese entorno.
7. Probar una búsqueda de más de veinte negocios y revisar el Workflow en el
   dashboard de Cloudflare.

`SUPABASE_KEY` debe ser la clave pública `anon` o publishable. No se necesita ni
se debe configurar `service_role` para esta arquitectura.

## Seguridad y límites

- Solo una sesión Supabase válida puede crear o consultar una ejecución.
- RLS limita runs y candidatos a su propietario o a un administrador.
- Cada usuario puede iniciar como máximo dos Workflows por minuto.
- La solicitud acepta hasta 200 candidatos y 768 KiB.
- Cada lote acepta hasta 25 resultados y 256 KiB en PostgreSQL.
- Los nombres de lote son idempotentes: repetir un callback no duplica progreso.
- Logs y trazas de Cloudflare permanecen habilitados.

## Compatibilidad y reversión

Si el binding durable no está disponible, la interfaz conserva el flujo anterior
de `/api/validate-businesses`. La reversión consiste en retirar el binding y el
entrypoint personalizado en una versión posterior; no se deben borrar runs ni
candidatos porque contienen auditoría comercial.
