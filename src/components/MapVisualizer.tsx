import React, { useState, useEffect } from "react";
import { Map, AdvancedMarker, Pin, InfoWindow, useMap } from "@vis.gl/react-google-maps";
import { ValidatedBusiness } from "../types";
import { Phone, Globe, DollarSign } from "lucide-react";

interface MapVisualizerProps {
  businesses: ValidatedBusiness[];
  selectedBiz: ValidatedBusiness | null;
  onSelectBiz: (biz: ValidatedBusiness | null) => void;
  onSaveLead?: (biz: ValidatedBusiness) => void;
  isSaved?: (id: string) => boolean;
}

function MapRecenter({ center }: { center: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (map && center) {
      map.panTo(center);
      map.setZoom(15);
    }
  }, [map, center]);
  return null;
}

export function MapVisualizer({ businesses, selectedBiz, onSelectBiz, onSaveLead, isSaved }: MapVisualizerProps) {
  const [activeWindow, setActiveWindow] = useState<ValidatedBusiness | null>(null);

  useEffect(() => {
    if (selectedBiz) {
      setActiveWindow(selectedBiz);
    }
  }, [selectedBiz]);

  const validLocations = businesses.filter(b => b.location);
  const defaultCenter = validLocations.length > 0
    ? {
        lat: validLocations.reduce((sum, b) => sum + b.location!.lat, 0) / validLocations.length,
        lng: validLocations.reduce((sum, b) => sum + b.location!.lng, 0) / validLocations.length,
      }
    : { lat: 6.1846, lng: -75.5969 }; // Center of Antioquia

  // Eye-friendly color mapping (Teal, Muted Blue, Soft Slate)
  const getMarkerColor = (score: number) => {
    if (score >= 80) return "#0f766e"; // Teal 700 (High opportunity)
    if (score >= 50) return "#2563eb"; // Blue 600 (Medium opportunity)
    return "#64748b"; // Slate 500 (Low opportunity)
  };

  const getMarkerGlyphColor = (score: number) => {
    if (score >= 80) return "#99f6e4"; // Teal 200
    if (score >= 50) return "#bfdbfe"; // Blue 200
    return "#e2e8f0"; // Slate 200
  };

  return (
    <div className="w-full h-full relative">
      <Map
        defaultZoom={13}
        defaultCenter={defaultCenter}
        mapId="bf50a916e79778cd"
        gestureHandling="cooperative"
        disableDefaultUI={false}
        className="w-full h-full"
      >
        {selectedBiz && selectedBiz.location && (
          <MapRecenter center={selectedBiz.location} />
        )}

        {businesses.map((biz) => {
          if (!biz.location) return null;
          
          const score = biz.opportunityScore;
          const isCurrentSelected = activeWindow?.id === biz.id;

          return (
            <AdvancedMarker
              key={biz.id}
              position={biz.location}
              title={biz.name}
              onClick={() => {
                setActiveWindow(biz);
                onSelectBiz(biz);
              }}
            >
              <Pin
                background={biz.isExistingDbClient ? "#4f46e5" : getMarkerColor(score)}
                borderColor={biz.isExistingDbClient ? "#312e81" : "#0f172a"}
                glyph={biz.isExistingDbClient ? "C" : undefined}
                glyphColor={biz.isExistingDbClient ? "#ffffff" : getMarkerGlyphColor(score)}
                scale={isCurrentSelected ? 1.25 : 1.0}
              />
            </AdvancedMarker>
          );
        })}

        {activeWindow && activeWindow.location && (
          <InfoWindow
            position={activeWindow.location}
            onCloseClick={() => {
              setActiveWindow(null);
              onSelectBiz(null);
            }}
            pixelOffset={[0, -10]}
          >
            <div className="p-3.5 max-w-[290px] font-sans text-xs text-slate-800 leading-normal">
              <div className="mb-2.5">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <h4 className="font-bold text-slate-900 text-sm leading-tight font-sans">{activeWindow.name}</h4>
                  <span 
                    className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white uppercase whitespace-nowrap shadow-sm font-sans"
                    style={{ backgroundColor: activeWindow.isExistingDbClient ? "#4f46e5" : getMarkerColor(activeWindow.opportunityScore) }}
                  >
                    {activeWindow.isExistingDbClient ? "Base de Datos" : `Score: ${activeWindow.opportunityScore}%`}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium font-sans">{activeWindow.address}</p>
              </div>
              
              {/* Mini-Dashboard Grid (2x2) */}
              <div className="grid grid-cols-2 gap-3 mb-3 bg-slate-50/80 p-3 rounded-xl border border-slate-100 font-sans">
                <div>
                  <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Tamaño</span>
                  <span className="px-1.5 py-0.2 rounded bg-slate-200/60 text-slate-700 text-[9.5px] font-bold capitalize">
                    {activeWindow.estimatedSize === 'micro' ? 'Micropyme' : activeWindow.estimatedSize === 'small' ? 'Pequeña' : 'Mediana'}
                  </span>
                </div>
                
                <div>
                  <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Huella Digital</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold capitalize ${
                    activeWindow.digitalFootprint === 'low' ? "bg-slate-200 text-slate-600" :
                    activeWindow.digitalFootprint === 'medium' ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-teal-50 text-teal-700 border border-teal-100"
                  }`}>
                    {activeWindow.digitalFootprint === 'low' ? 'Baja' : activeWindow.digitalFootprint === 'medium' ? 'Media' : 'Alta'}
                  </span>
                </div>

                <div className="col-span-2 border-t border-slate-250/20 pt-2">
                  <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Necesidad Financiera</span>
                  <span className="font-semibold text-teal-800 text-[10.5px] flex items-center gap-0.5">
                    <DollarSign size={11} className="text-teal-600" />
                    {activeWindow.predictedNeed}
                  </span>
                </div>
              </div>

              {activeWindow.reasoning && (
                <div className="mb-3.5 bg-teal-50/20 p-2.5 rounded-lg border border-teal-100/50 italic text-slate-600 text-[10.5px] font-serif leading-relaxed border-l-2 border-l-teal-600">
                  <span className="text-[8px] font-sans font-bold uppercase tracking-wider text-slate-400 not-italic block mb-0.5">Descripción de Negocio</span>
                  "{activeWindow.reasoning}"
                </div>
              )}

              <div className="flex justify-between items-center gap-2 border-t border-slate-100 pt-2.5 font-sans">
                <div className="flex gap-1.5">
                  {activeWindow.phone && (
                    <a 
                      href={`tel:${activeWindow.phone}`}
                      className="p-1.5 border border-slate-200 hover:border-teal-500 rounded-lg hover:bg-teal-50/20 transition-all text-slate-500 hover:text-teal-600"
                      title={activeWindow.phone}
                    >
                      <Phone size={12} />
                    </a>
                  )}
                  {activeWindow.website && (
                    <a 
                      href={activeWindow.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-1.5 border border-slate-200 hover:border-teal-500 rounded-lg hover:bg-teal-50/20 transition-all text-slate-500 hover:text-teal-600"
                    >
                      <Globe size={12} />
                    </a>
                  )}
                </div>

                {onSaveLead && (
                  <button
                    onClick={() => onSaveLead(activeWindow)}
                    disabled={isSaved?.(activeWindow.id)}
                    className={`px-3 py-1.5 rounded-lg text-[9.5px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      isSaved?.(activeWindow.id)
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none"
                        : "bg-teal-600 text-white hover:bg-teal-700 border border-teal-600 shadow-sm"
                    }`}
                  >
                    {isSaved?.(activeWindow.id) ? "Guardado" : "Guardar Lead"}
                  </button>
                )}
              </div>
            </div>
          </InfoWindow>
        )}
      </Map>
    </div>
  );
}
