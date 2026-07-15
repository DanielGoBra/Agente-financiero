import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async () => {
  try {
    const apiKey = (env as any).GOOGLE_MAPS_PLATFORM_KEY || '';
    const supabaseUrl = (env as any).PUBLIC_SUPABASE_URL || (env as any).SUPABASE_URL || '';
    const supabaseAnonKey = (env as any).PUBLIC_SUPABASE_ANON_KEY || (env as any).SUPABASE_ANON_KEY || (env as any).SUPABASE_KEY || '';

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
  } catch (err: any) {
    return new Response(JSON.stringify({
      error: err.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
