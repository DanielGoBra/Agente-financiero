import type { APIRoute } from 'astro';

export const GET: APIRoute = async (context) => {
  try {
    // Debug: inspect what's available in context.locals
    const locals = context.locals as any;
    const debugInfo: any = {
      hasLocals: !!locals,
      localsKeys: locals ? Object.keys(locals) : [],
      hasRuntime: !!locals?.runtime,
      runtimeKeys: locals?.runtime ? Object.keys(locals.runtime) : [],
      hasEnv: !!locals?.runtime?.env,
      envKeys: locals?.runtime?.env ? Object.keys(locals.runtime?.env).filter((k: string) => !k.startsWith('__')) : [],
    };

    const getEnv = (key: string): string => {
      // Try Cloudflare Workers env (via Astro adapter)
      const cfEnv = locals?.runtime?.env?.[key];
      if (cfEnv) return cfEnv;

      // Try direct env on locals (some adapter versions)
      const directEnv = locals?.env?.[key];
      if (directEnv) return directEnv;

      // Try globalThis (Cloudflare Workers sometimes binds secrets here)
      const globalEnv = (globalThis as any)[key];
      if (globalEnv) return globalEnv;

      // Try process.env (Node.js / local dev)
      if (typeof process !== 'undefined' && process.env) {
        return process.env[key] || '';
      }
      return '';
    };

    const apiKey = getEnv('GOOGLE_MAPS_PLATFORM_KEY');
    const supabaseUrl = getEnv('PUBLIC_SUPABASE_URL') || getEnv('SUPABASE_URL');
    const supabaseAnonKey = getEnv('PUBLIC_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY') || getEnv('SUPABASE_KEY');

    // Include debug info temporarily so we can diagnose
    return new Response(JSON.stringify({ 
      apiKey,
      supabaseUrl,
      supabaseAnonKey,
      _debug: debugInfo
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (err: any) {
    // Return the actual error so we can see it in the browser
    return new Response(JSON.stringify({
      error: err.message,
      stack: err.stack,
      name: err.name,
    }), {
      status: 200, // Use 200 so the browser shows the JSON
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
