import type { APIRoute } from 'astro';
import {
  getRuntimeString,
  getSupabasePublicConfig,
  isBrowserSafeSupabaseKey,
  jsonResponse,
} from '../../lib/server/security';

export const GET: APIRoute = async () => {
  try {
    const apiKey = getRuntimeString('GOOGLE_MAPS_PLATFORM_KEY');
    const { url: supabaseUrl, key: supabaseAnonKey } = getSupabasePublicConfig();

    if (!apiKey || !supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: 'La configuración pública está incompleta.' }, 503);
    }

    if (!isBrowserSafeSupabaseKey(supabaseAnonKey)) {
      console.error(JSON.stringify({ event: 'unsafe_supabase_key_blocked' }));
      return jsonResponse({ error: 'La clave configurada para el navegador no es una clave pública de Supabase.' }, 503);
    }

    return jsonResponse({
      apiKey,
      supabaseUrl,
      supabaseAnonKey
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'public_config_error',
      message: error instanceof Error ? error.message : 'unknown',
    }));
    return jsonResponse({ error: 'No se pudo cargar la configuración pública.' }, 500);
  }
};
