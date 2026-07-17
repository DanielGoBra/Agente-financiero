# Runbook de la Fase 0

## Alcance

La primera migración es aditiva: crea las fundaciones del nuevo CRM, pero no
modifica, migra ni elimina registros de `empresas_formales`. Por esta razón no
cambia el comportamiento de la web hasta que una fase posterior conecte las
nuevas tablas.

## Orden de despliegue

1. Crear o seleccionar un proyecto Supabase de staging.
2. Verificar que el esquema base y `supabase_security_hardening.sql` estén
   aplicados.
3. Tomar un respaldo o snapshot antes de cualquier migración en producción.
4. Aplicar `supabase/migrations/20260716000100_crm_foundation.sql` en staging.
5. Ejecutar las pruebas de `supabase/tests/database` con Supabase CLI y pgTAP.
6. Probar con una cuenta `asesor` y una cuenta `admin`.
7. Revisar Security Advisor, índices y políticas en el dashboard de Supabase.
8. Aplicar en producción solamente después de aprobar staging.

## Comandos de validación

```text
npm run lint
npm run build
npx supabase test db
```

La prueba de base de datos requiere Supabase CLI, Docker y un proyecto local
inicializado. No debe ejecutarse contra la base productiva.

## Criterios de aceptación

- Las ocho tablas nuevas existen y tienen RLS forzado.
- Un asesor solo puede consultar y actualizar sus propias empresas.
- Un asesor no puede registrar actividades sobre empresas de otro asesor.
- Actividades e historial no permiten actualización ni eliminación desde el
  rol `authenticated`.
- Existen las quince etapas iniciales del pipeline.
- La aplicación actual compila sin utilizar ninguna tabla nueva.

## Reversión

Como la aplicación aún no depende del nuevo modelo, la primera respuesta ante
un incidente es detener la adopción y corregir mediante una migración posterior.
No se deben eliminar tablas directamente en producción si ya contienen datos de
prueba o auditoría. La reversión destructiva exige respaldo y aprobación manual.
