import React from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { MapAgent } from "./components/MapAgent";

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

export default function App() {
  if (!hasValidKey) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 font-sans p-4">
        <div className="text-center max-w-lg bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Se requiere API Key de Google Maps</h2>
          <div className="text-left text-slate-600 space-y-4">
            <p><strong>Paso 1:</strong> Obtén tu API Key en la <a href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Consola de Google Cloud</a> (habilita la API Places - New).</p>
            <p><strong>Paso 2:</strong> Configura tu clave como secreto:</p>
            <ul className="list-disc pl-5 space-y-2 text-sm bg-slate-50 p-4 rounded-lg border border-slate-100">
              <li>Abre <strong>Settings</strong> (icono de engranaje ⚙️, arriba a la derecha).</li>
              <li>Selecciona <strong>Secrets</strong>.</li>
              <li>Escribe <code>GOOGLE_MAPS_PLATFORM_KEY</code> como nombre del secreto, y presiona <strong>Enter</strong>.</li>
              <li>Pega tu API Key como valor y presiona <strong>Enter</strong>.</li>
            </ul>
            <p className="text-sm mt-4 text-slate-500 text-center">La aplicación se recargará automáticamente al agregar el secreto.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY} version="weekly" language="es">
      <div className="h-screen w-full flex flex-col">
        <MapAgent />
      </div>
    </APIProvider>
  );
}
