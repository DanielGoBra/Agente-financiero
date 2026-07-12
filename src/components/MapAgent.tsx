import React, { useState, useEffect } from "react";
import { useMapsLibrary, useMap } from "@vis.gl/react-google-maps";
import { Search, Loader2, Download, AlertCircle, FileSpreadsheet } from "lucide-react";
import { ExtractedBusiness, ValidatedBusiness } from "../types";
import { exportToExcel } from "../lib/exportUtils";
import { cn } from "../lib/utils";

const ZONES = [
  { id: "Itagüí", name: "Itagüí, Antioquia", subZonas: ["Centro", "Santa María", "Ditaires", "Simón Bolívar", "San José", "La Independencia"] },
  { id: "San Antonio de Prado", name: "San Antonio de Prado, Medellín, Antioquia", subZonas: ["Parque Principal", "Barichara", "Limonar", "Pradito"] },
  { id: "Caldas", name: "Caldas, Antioquia", subZonas: ["Centro", "La Inmaculada", "Mandalay", "La Locería", "Andalucía"] },
  { id: "La Estrella", name: "La Estrella, Antioquia", subZonas: ["Parque Principal", "La Aldea", "Pueblo Viejo", "La Tablaza"] }
];

const MUNICIPALITIES = ZONES.map(z => z.name);

const SEARCH_TERMS = [
  "Tiendas de barrio",
  "Ferreterías",
  "Panaderías",
  "Restaurantes",
  "Peluquerías",
  "Farmacias",
  "Talleres de motos",
  "Papelerías"
];

export function MapAgent() {
  const placesLib = useMapsLibrary("places");
  const [municipality, setMunicipality] = useState(MUNICIPALITIES[0]);
  const [searchTerm, setSearchTerm] = useState(SEARCH_TERMS[0]);
  
  const [isExtracting, setIsExtracting] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [results, setResults] = useState<ValidatedBusiness[]>([]);
  const [error, setError] = useState("");

  const handleStartExtraction = async () => {
    if (!placesLib) {
      setError("La librería de mapas no está lista. Intenta nuevamente.");
      return;
    }
    
    setIsExtracting(true);
    setError("");
    setResults([]);
    
    try {
      // Step 1: Find places on Google Maps across multiple sub-zones to get more results
      const selectedZone = ZONES.find(z => z.name === municipality);
      const subZonas = selectedZone ? selectedZone.subZonas : [""];
      
      let allExtracted: ExtractedBusiness[] = [];
      
      for (const subZona of subZonas) {
        setStatusText(`Buscando "${searchTerm}" en ${subZona}, ${municipality.split(",")[0]}...`);
        const query = `${searchTerm} en ${subZona}, ${municipality}`;
        
        try {
          const response = await placesLib.Place.searchByText({
            textQuery: query,
            fields: [
              'id', 
              'displayName', 
              'formattedAddress', 
              'internationalPhoneNumber', 
              'businessStatus',
              'websiteURI',
              'rating',
              'userRatingCount',
              'types'
            ],
            language: 'es',
            maxResultCount: 20
          });

          if (response.places && response.places.length > 0) {
            const extracted: ExtractedBusiness[] = response.places.map(p => ({
              id: p.id,
              name: p.displayName || "Sin nombre",
              address: p.formattedAddress || "Sin dirección",
              phone: p.internationalPhoneNumber || "",
              municipality: municipality.split(",")[0],
              website: p.websiteURI || "",
              rating: p.rating || 0,
              userRatingsTotal: p.userRatingCount || 0,
              businessStatus: p.businessStatus || "OPERATIONAL",
              types: p.types || []
            }));

            for (const b of extracted) {
              if (!allExtracted.find(existing => existing.id === b.id)) {
                allExtracted.push(b);
              }
            }
          }
        } catch (e) {
          console.error("Error searching in subzone:", subZona, e);
        }
      }

      if (allExtracted.length === 0) {
        setStatusText("No se encontraron resultados para esta búsqueda.");
        setIsExtracting(false);
        return;
      }

      setStatusText(`Se recopilaron ${allExtracted.length} negocios. Analizando con IA (filtrando grandes cadenas)...`);

      // Step 2: Validate via Backend (Gemini API)
      // If we have a lot of businesses, we chunk them into 20 at a time to avoid huge prompts and timeouts
      let validations: any[] = [];
      const chunkSize = 20;
      for (let i = 0; i < allExtracted.length; i += chunkSize) {
        const chunk = allExtracted.slice(i, i + chunkSize);
        setStatusText(`Analizando lote ${Math.floor(i/chunkSize) + 1} de ${Math.ceil(allExtracted.length/chunkSize)}...`);
        
        const valRes = await fetch("/api/validate-businesses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businesses: chunk })
        });

        if (!valRes.ok) {
          const errText = await valRes.text();
          let errData;
          try { errData = JSON.parse(errText); } catch(e) {}
          throw new Error(errData?.error || `Fallo en la validación del servidor (Status: ${valRes.status}). Reintenta la búsqueda.`);
        }

        const valData = await valRes.json();
        validations = [...validations, ...valData.validations];
      }
      
      // Step 3: Merge data
      setStatusText("Procesando resultados finales...");
      
      const mergedResults: ValidatedBusiness[] = allExtracted.map(ext => {
        const aiAnalysis = validations.find((v: any) => v.id === ext.id);
        return {
          ...ext,
          isMicroSME: aiAnalysis ? aiAnalysis.isMicroSME : true, // Default to true if not found
          reliabilityScore: aiAnalysis ? aiAnalysis.reliabilityScore : 5,
          reasoning: aiAnalysis ? aiAnalysis.reasoning : "Análisis no disponible"
        };
      });

      // Filter only those that are MICRO or SMEs based on AI response, and sort by reliability
      const finalResults = mergedResults
        .filter(b => b.isMicroSME)
        .sort((a, b) => b.reliabilityScore - a.reliabilityScore);

      setResults(finalResults);
      setStatusText(`Extracción completada. ${finalResults.length} negocios validados.`);
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocurrió un error inesperado.");
      setStatusText("");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="w-full h-full bg-[#FDFCFB] text-[#1A1A1A] font-serif overflow-hidden flex flex-col border-8 border-white shadow-inner">
      {/* Header Section: Editorial Hero */}
      <header className="p-8 md:p-10 border-b border-black flex flex-col md:flex-row justify-between items-start md:items-end bg-[#F9F7F2] gap-4">
        <div className="max-w-2xl">
          <p className="uppercase tracking-widest text-xs font-sans font-bold mb-2 text-emerald-900">Inteligencia de Mercado v4.2</p>
          <h1 className="text-5xl md:text-7xl font-light leading-none tracking-tighter">
            Prospectos <span className="italic">Financieros</span><br/>Antioquia Sur
          </h1>
        </div>
        <div className="text-left md:text-right font-sans">
          <div className="text-3xl md:text-4xl font-bold mb-1">{results.length > 0 ? results.length : "0"}</div>
          <p className="text-[10px] uppercase tracking-wider opacity-60">Negocios Detectados en Zona</p>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar: Controls & Parameters */}
        <aside className="w-full md:w-80 border-b md:border-b-0 md:border-r border-black p-6 md:p-8 flex flex-col gap-6 md:gap-8 bg-[#FDFCFB] overflow-y-auto">
          <section>
            <h3 className="font-sans uppercase text-[10px] font-bold tracking-[0.2em] mb-4 text-emerald-800 underline underline-offset-4">Zonas y Parámetros</h3>
            
            <div className="space-y-4 font-sans">
              <div className="space-y-1.5 flex-1">
                <label className="text-xs font-medium opacity-70">Zona / Municipio</label>
                <select
                  value={municipality}
                  onChange={(e) => setMunicipality(e.target.value)}
                  disabled={isExtracting}
                  className="w-full bg-transparent border-b border-black/20 py-1 text-sm focus:outline-none focus:border-black transition-colors"
                >
                  {MUNICIPALITIES.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-1.5 flex-1">
                <label className="text-xs font-medium opacity-70">Tipo de Negocio</label>
                <select
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  disabled={isExtracting}
                  className="w-full bg-transparent border-b border-black/20 py-1 text-sm focus:outline-none focus:border-black transition-colors"
                >
                  {SEARCH_TERMS.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section>
            <button
              onClick={handleStartExtraction}
              disabled={isExtracting}
              className={cn(
                "w-full font-sans text-xs uppercase tracking-widest py-3 transition-colors border",
                isExtracting 
                  ? "bg-[#F9F7F2] text-black/40 border-black/20 cursor-not-allowed"
                  : "bg-black text-white border-black hover:bg-emerald-950"
              )}
            >
              {isExtracting ? "Procesando..." : "Iniciar Rastreo"}
            </button>
            
            {statusText && (
              <p className="font-sans text-[10px] mt-3 opacity-60 leading-tight">
                {statusText}
              </p>
            )}
            
            {error && (
              <p className="font-sans text-[10px] mt-3 text-red-700 leading-tight">
                {error}
              </p>
            )}
          </section>

          {results.length > 0 && (
            <section className="mt-auto">
              <h3 className="font-sans uppercase text-[10px] font-bold tracking-[0.2em] mb-4 text-emerald-800">Exportación</h3>
              <button
                onClick={() => exportToExcel(results, `negocios_${municipality.split(",")[0]}_${searchTerm.replace(/\s+/g, "_")}.xlsx`)}
                className="w-full border border-black font-sans text-xs uppercase tracking-widest py-3 hover:bg-black hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <FileSpreadsheet size={14} />
                Exportar Excel
              </button>
            </section>
          )}
        </aside>

        {/* Main Content: Data View */}
        <main className="flex-1 p-6 md:p-8 overflow-auto">
          <div className="flex flex-col md:flex-row md:justify-between md:items-baseline mb-6 border-b border-black pb-2 gap-2">
            <h2 className="text-2xl italic">Base de Datos de Créditos</h2>
            <p className="font-sans text-[11px] opacity-60 italic">Filtrado por: Independientes & Microempresas</p>
          </div>

          {results.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-xs border-collapse">
                <thead>
                  <tr className="uppercase tracking-tighter opacity-40 border-b border-black">
                    <th className="pb-2 font-bold min-w-[200px]">Negocio</th>
                    <th className="pb-2 font-bold">Categoría</th>
                    <th className="pb-2 font-bold min-w-[150px]">Ubicación</th>
                    <th className="pb-2 font-bold text-right">Teléfono</th>
                    <th className="pb-2 font-bold text-right">Confianza</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                  {results.map((biz) => (
                    <tr key={biz.id} className="hover:bg-black/5 transition-colors">
                      <td className="py-4 font-serif text-base align-top">
                        <div className="font-serif">{biz.name}</div>
                        <div className="text-[10px] font-sans opacity-50 mt-1 max-w-[250px] leading-tight">
                           {biz.reasoning}
                        </div>
                      </td>
                      <td className="py-4 align-top">
                        <span className="border border-black px-1.5 py-0.5 rounded-full capitalize">
                          {biz.types[0]?.replace(/_/g, ' ') || 'Local'}
                        </span>
                      </td>
                      <td className="py-4 italic align-top">
                        <div className="max-w-[200px] leading-tight">{biz.address}</div>
                        <div className="opacity-60 text-[10px] not-italic mt-0.5">{biz.municipality}</div>
                      </td>
                      <td className="py-4 text-right align-top">
                        <div className="font-mono text-xs">{biz.phone || "N/D"}</div>
                        {biz.website && (
                          <a href={biz.website} target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 text-[10px] mt-1 block">
                            Web ↗
                          </a>
                        )}
                      </td>
                      <td className="py-4 text-right align-top">
                        <span className={cn(
                          "font-bold text-base",
                          biz.reliabilityScore >= 8 ? "text-emerald-800" :
                          biz.reliabilityScore >= 5 ? "text-amber-700" : "text-red-700"
                        )}>
                          {biz.reliabilityScore * 10}%
                        </span>
                        {biz.rating > 0 && (
                          <div className="text-[10px] opacity-60 mt-1">
                            ★ {biz.rating} ({biz.userRatingsTotal})
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border-t border-black">
                  <h4 className="text-[10px] font-sans font-bold uppercase mb-2">Análisis de Vigencia</h4>
                  <p className="text-sm leading-tight italic">Los registros listados han sido evaluados y clasificados por IA según su perfil comercial reciente.</p>
                </div>
                <div className="p-4 border-t border-black">
                  <h4 className="text-[10px] font-sans font-bold uppercase mb-2">Siguiente Paso</h4>
                  <p className="text-sm leading-tight italic">Descargue el informe detallado para la segmentación de ofertas de crédito pre-aprobado.</p>
                </div>
              </div>
            </div>
          ) : !isExtracting && !error ? (
            <div className="h-40 flex flex-col items-center justify-center text-black/30 border border-dashed border-black/20 bg-black/5 mt-8">
              <Search size={24} className="mb-2 opacity-50" />
              <p className="font-sans text-xs uppercase tracking-widest">Esperando Parámetros</p>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
