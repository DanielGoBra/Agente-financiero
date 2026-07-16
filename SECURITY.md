# Seguridad de producción

## Controles incluidos en el código

- El endpoint de OpenRouter exige una sesión real de Supabase y valida el token contra Supabase Auth.
- Las solicitudes de IA tienen validación de origen, tamaño, estructura, cantidad y tipos de datos.
- Cloudflare limita cada usuario a 8 análisis por minuto mediante un Rate Limiting binding.
- Las respuestas de error no revelan detalles del proveedor ni secretos.
- La salida del modelo se valida y solo acepta identificadores enviados por la aplicación.
- Se aplican CSP, HSTS, anti-framing, `nosniff`, política de permisos y `no-store` en APIs.
- La configuración pública bloquea claves Supabase `service_role` y `sb_secret`.
- La dependencia SheetJS usa la distribución corregida 0.20.3.

## Paso obligatorio en Supabase

Ejecuta `supabase_security_hardening.sql` una vez desde el SQL Editor de Supabase. La migración:

- activa y fuerza RLS;
- elimina las políticas heredadas antes de instalar un conjunto cerrado;
- impide que un usuario se asigne el rol de administrador;
- restringe empresas y leads al propietario, territorio asignado o administradores;
- limita la bitácora a inserciones propias y lectura administrativa;
- endurece la función de alta de usuarios con un `search_path` fijo;
- agrega índices para las columnas usadas por las políticas.

Prueba después con una cuenta `asesor` y una cuenta `admin` antes de modificar más políticas.

## Secretos y claves

Configura en Cloudflare:

- `OPENROUTER_API_KEY`: secreto del Worker, nunca variable pública.
- `OPENROUTER_MODEL`: nombre del modelo; no es secreto.
- `GOOGLE_MAPS_PLATFORM_KEY`: visible en el navegador por diseño; debe estar restringida en Google Cloud.
- `PUBLIC_SUPABASE_URL`: URL pública del proyecto.
- `PUBLIC_SUPABASE_ANON_KEY`: clave `sb_publishable` o `anon`, nunca `service_role`/`sb_secret`.

Rota inmediatamente cualquier clave que haya aparecido en un repositorio, captura de pantalla, chat o log público.

## Configuración externa recomendada

### Google Cloud

- Restringe la clave por `HTTP referrers` al dominio exacto de producción y a los dominios locales necesarios.
- Restringe la clave únicamente a Maps JavaScript API y Places API.
- Configura alertas de presupuesto y cuotas razonables.

### OpenRouter

- Usa una clave exclusiva para esta aplicación.
- Define límite de crédito y reinicio mensual en la configuración de la clave.
- Rota la clave si OpenRouter o GitHub notifican una exposición.

### Supabase Auth

- Desactiva registros públicos si las cuentas se crean de forma administrativa.
- Exige contraseñas largas y activa protección de contraseñas filtradas.
- Activa MFA para administradores.
- Revisa periódicamente usuarios, sesiones y eventos de autenticación.

### Cloudflare

- Mantén activas las reglas administradas del WAF y protección DDoS.
- Revisa Workers Logs para respuestas `401`, `403`, `413` y `429`.
- Añade Turnstile al inicio de sesión si observas ataques de credenciales o automatización. Turnstile requiere crear un widget y guardar `TURNSTILE_SECRET` como secreto independiente.

## Respuesta a incidentes

1. Revoca o rota la clave afectada.
2. Cierra sesiones activas en Supabase cuando corresponda.
3. Revisa actividad de OpenRouter, Google Cloud, Supabase y Cloudflare.
4. Corrige la causa antes de volver a emitir la clave.
5. Documenta fecha, alcance y acciones tomadas.
