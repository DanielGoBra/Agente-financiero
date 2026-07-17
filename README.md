# Agente Financiero PYME

Aplicación Astro + React desplegada en Cloudflare Workers. Usa Supabase para autenticación y datos, Google Maps Platform para búsqueda geográfica y OpenRouter para la clasificación de oportunidades.

## Desarrollo local

1. Instala las dependencias con `npm install`.
2. Copia `.env.example` a `.env` y configura valores locales.
3. Inicia el proyecto con `npm run dev`.

Nunca uses una clave `service_role` o `sb_secret` de Supabase en una variable pública. La aplicación valida este requisito antes de entregar configuración al navegador.

## Producción

Antes de desplegar cambios de seguridad, sigue [SECURITY.md](./SECURITY.md) y ejecuta `supabase_security_hardening.sql` en el editor SQL del proyecto Supabase.

La evolución hacia el CRM profesional está documentada en
[`docs/CRM_ARCHITECTURE.md`](./docs/CRM_ARCHITECTURE.md). La primera migración
es aditiva y su despliegue seguro se describe en
[`docs/CRM_PHASE_0_RUNBOOK.md`](./docs/CRM_PHASE_0_RUNBOOK.md).
La activación gradual del tablero operativo, Lead 360, contactos, tareas y
timeline se describe en
[`docs/CRM_PHASE_2_RUNBOOK.md`](./docs/CRM_PHASE_2_RUNBOOK.md).
La prospección durable, sus reintentos y el procedimiento de activación se
documentan en
[`docs/CRM_PHASE_3_RUNBOOK.md`](./docs/CRM_PHASE_3_RUNBOOK.md).

Validaciones recomendadas:

```text
npm run generate-types
npm run lint
npm run build
npm audit --omit=dev
```
