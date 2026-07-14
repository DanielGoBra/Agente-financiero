import React, { useState, useEffect } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { MapAgent } from "./components/MapAgent";
import { Login } from "./components/Login";
import { initSupabase, authService } from "./lib/supabase";
import { UserProfile } from "./types";
import { Loader2, ShieldAlert } from "lucide-react";
import { getApiUrl } from "./lib/api";

export default function App() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Fetch Google Maps & Supabase keys dynamically from Astro API endpoint
    fetch(getApiUrl("/api/config"))
      .then((res) => {
        if (!res.ok) throw new Error("Error en la conexión con el servidor.");
        return res.json();
      })
      .then(async (data) => {
        if (data.apiKey && data.apiKey !== "YOUR_GOOGLE_MAPS_API_KEY" && data.apiKey !== "") {
          setApiKey(data.apiKey);
          
          // Initialize Supabase (real or fallback demo mode)
          initSupabase(data.supabaseUrl || "", data.supabaseAnonKey || "");
          
          // Check for active session
          const sessionUser = await authService.getSession();
          if (sessionUser) {
            setUser(sessionUser);
          }
        } else {
          setErrorMsg("La clave de API de Google Maps ('GOOGLE_MAPS_PLATFORM_KEY') no está configurada o tiene el valor por defecto en el archivo .env del servidor.");
        }
      })
      .catch((err) => {
        console.error(err);
        setErrorMsg("No se pudo cargar la configuración de API desde el servidor. Asegúrate de tener el servidor corriendo y el archivo .env configurado.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 font-sans p-6 text-slate-400">
        <Loader2 className="animate-spin text-teal-500 mb-3" size={32} />
        <p className="text-sm font-medium tracking-wide uppercase">Cargando configuración de servicios...</p>
      </div>
    );
  }

  if (errorMsg || !apiKey) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 font-sans p-4">
        <div className="text-center max-w-lg bg-slate-900 p-8 rounded-3xl shadow-2xl border border-slate-800/60 text-slate-300">
          <ShieldAlert className="text-rose-500 mx-auto mb-4" size={44} />
          <h2 className="text-2xl font-bold text-white mb-3">Configuración de API Requerida</h2>
          <div className="text-left text-slate-400 space-y-4 text-sm border-t border-slate-800/40 pt-4">
            <p className="leading-relaxed">
              Para el correcto funcionamiento del localizador geográfico y del mapa interactivo, debes configurar tus API keys en el archivo <code className="bg-slate-950 px-1.5 py-0.5 rounded text-xs text-rose-400 font-mono border border-slate-800">.env</code> de la raíz del proyecto.
            </p>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
              <p># Configura estas variables en tu archivo .env:</p>
              <p><span className="text-teal-400">GEMINI_API_KEY</span>="tu_api_key_de_gemini"</p>
              <p><span className="text-teal-400">GOOGLE_MAPS_PLATFORM_KEY</span>="tu_api_key_de_google_maps"</p>
            </div>
            <p className="text-[11px] text-slate-500 italic">
              * Nota: Una vez agregadas las claves en el archivo .env, reinicia el servidor de desarrollo para aplicar los cambios.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onAuthSuccess={setUser} />;
  }

  return (
    <APIProvider apiKey={apiKey} version="weekly" language="es">
      <div className="h-screen w-full flex flex-col bg-slate-50">
        <MapAgent 
          currentUser={user} 
          onLogout={() => {
            authService.signOut();
            setUser(null);
          }} 
          onUserUpdate={setUser}
        />
      </div>
    </APIProvider>
  );
}
