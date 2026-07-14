import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const apiKey = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';
  
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
