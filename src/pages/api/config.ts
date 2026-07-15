import type { APIRoute } from 'astro';

export const GET: APIRoute = async (context) => {
  const getEnv = (key: string) => {
    const cfEnv = (context.locals as any)?.runtime?.env?.[key];
    if (cfEnv) return cfEnv;
    const globalEnv = (globalThis as any)[key];
    if (globalEnv) return globalEnv;
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key] || '';
    }
    return '';
  };

  const apiKey = getEnv('GOOGLE_MAPS_PLATFORM_KEY');
  const supabaseUrl = getEnv('PUBLIC_SUPABASE_URL') || getEnv('SUPABASE_URL');
  const supabaseAnonKey = getEnv('PUBLIC_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY') || getEnv('SUPABASE_KEY');
  
  return new Response(JSON.stringify({ 
    apiKey,
    supabaseUrl,
    supabaseAnonKey
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
