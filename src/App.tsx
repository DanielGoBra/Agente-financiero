import React, { useState, useEffect } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { MapAgent } from "./components/MapAgent";
import { Login } from "./components/Login";
import { initSupabase, authService } from "./lib/supabase";
import { UserProfile } from "./types";
import { Loader2, ShieldAlert } from "lucide-react";

export default function App() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Fetch Google Maps & Supabase keys dynamically from Astro API endpoint
    fetch("/api/config")
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-animated font-body p-6 text-slate-300">
        <div className="glass-dark rounded-3xl px-10 py-9 text-center shadow-heavy min-w-[280px]">
          <img src="/logo-pymes.svg" alt="Localizador PYMEs" className="w-11 h-11 mx-auto mb-5 drop-shadow-lg" />
          <Loader2 className="animate-spin text-ink-400 mx-auto mb-4" size={26} />
          <p className="text-[11px] font-semibold tracking-[0.16em] uppercase">Preparando tu espacio de trabajo</p>
          <p className="text-[10px] text-slate-500 mt-2">Conectando servicios de prospección</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !apiKey) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-animated font-body p-4">
        <div className="text-center max-w-lg glass-dark p-8 md:p-10 rounded-3xl shadow-heavy text-slate-300">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-rose-500/10 border border-rose-400/20 flex items-center justify-center">
            <ShieldAlert className="text-rose-400" size={28} />
          </div>
          <p className="section-kicker mb-2">Configuración del sistema</p>
          <h2 className="text-2xl font-bold text-white mb-3">Conexión requerida</h2>
          <div className="text-left text-slate-400 space-y-4 text-sm border-t border-slate-800/40 pt-4">
            <p className="leading-relaxed">
              Para el correcto funcionamiento del localizador geográfico y del mapa interactivo, debes configurar tus API keys en el archivo <code className="bg-slate-950 px-1.5 py-0.5 rounded text-xs text-rose-400 font-mono border border-slate-800">.env</code> de la raíz del proyecto.
            </p>
            <div className="bg-dark-0/70 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
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
      <div className="h-screen w-full flex flex-col workspace-shell">
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
