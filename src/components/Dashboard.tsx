import React from "react";
import { ValidatedBusiness } from "../types";
import { TYPE_TRANSLATIONS } from "../lib/typeTranslations";
import { 
  TrendingUp, Users, Target, Activity, DollarSign, 
  MapPin, AlertCircle, Award, PieChart, BarChart3
} from "lucide-react";

interface DashboardProps {
  leads: ValidatedBusiness[];
}

export function Dashboard({ leads }: DashboardProps) {
  if (leads.length === 0) {
    return (
      <div className="flex-1 p-6 md:p-8 flex flex-col justify-center items-center text-center bg-slate-50 font-sans">
        <div className="max-w-md border border-dashed border-slate-200 bg-white p-8 rounded-2xl shadow-sm">
          <Activity size={36} className="mx-auto mb-3.5 text-teal-600 opacity-60 animate-pulse" />
          <h3 className="text-slate-800 text-sm font-bold uppercase tracking-wider">Métricas del Pipeline</h3>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            No hay prospectos guardados en el CRM todavía. Guarda negocios desde la pestaña de Búsqueda y Mapa para generar los reportes y estadísticas de crédito automáticamente.
          </p>
        </div>
      </div>
    );
  }

  const totalLeads = leads.length;
  
  const avgOpportunity = Math.round(
    leads.reduce((sum, l) => sum + l.opportunityScore, 0) / totalLeads
  );

  const pipelineStats = {
    nuevo: leads.filter(l => (l.crmStatus || "nuevo") === "nuevo").length,
    contactado: leads.filter(l => l.crmStatus === "contactado").length,
    interesado: leads.filter(l => l.crmStatus === "interesado").length,
    aprobado: leads.filter(l => l.crmStatus === "aprobado").length,
    descartado: leads.filter(l => l.crmStatus === "descartado").length,
  };

  const activeLeadsCount = pipelineStats.contactado + pipelineStats.interesado + pipelineStats.aprobado;
  const activePercentage = Math.round((activeLeadsCount / totalLeads) * 100);

  // Muted credit demand multiplier
  const portfolioValue = leads.reduce((sum, l) => {
    const status = l.crmStatus || "nuevo";
    if (status === "descartado") return sum;
    
    let multiplier = 10;
    if (l.estimatedSize === "small") multiplier = 35;
    if (l.estimatedSize === "medium") multiplier = 100;
    
    return sum + multiplier;
  }, 0);

  const categoryCounts: Record<string, number> = {};
  leads.forEach(l => {
    const rawCat = l.types[0] || "General";
    const cat = TYPE_TRANSLATIONS[rawCat.toLowerCase()] || rawCat.replace(/_/g, ' ');
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });
  
  const sortedCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const sizeCounts = {
    micro: leads.filter(l => l.estimatedSize === "micro").length,
    small: leads.filter(l => l.estimatedSize === "small").length,
    medium: leads.filter(l => l.estimatedSize === "medium").length,
  };

  const needCounts: Record<string, number> = {};
  leads.forEach(l => {
    const need = l.predictedNeed || "Capital de Trabajo";
    needCounts[need] = (needCounts[need] || 0) + 1;
  });

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-8 bg-slate-100/50 font-sans">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Métricas y KPIs</h2>
        <p className="text-xs text-slate-400 font-medium mt-0.5">
          Indicadores clave del portafolio financiero y embudo de conversión en tiempo real.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Prospects */}
        <div className="border border-slate-200/70 p-5 bg-white flex flex-col justify-between h-28 rounded-xl shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Prospectos</span>
            <Users size={16} className="text-slate-400" />
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-800 tracking-tight">{totalLeads}</div>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Empresas en CRM</p>
          </div>
        </div>

        {/* Avg Opportunity */}
        <div className="border border-slate-200/70 p-5 bg-white flex flex-col justify-between h-28 rounded-xl shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Score de Captación</span>
            <Target size={16} className="text-slate-400" />
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-800 tracking-tight">{avgOpportunity}%</div>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Viabilidad crediticia promedio</p>
          </div>
        </div>

        {/* Active Ratio */}
        <div className="border border-slate-200/70 p-5 bg-white flex flex-col justify-between h-28 rounded-xl shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Tasa de Contacto</span>
            <TrendingUp size={16} className="text-slate-400" />
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-800 tracking-tight">{activePercentage}%</div>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{activeLeadsCount} Leads en contacto</p>
          </div>
        </div>

        {/* Estimated Demand Portfolio - Soft Teal Accent Card */}
        <div className="border border-teal-700/10 p-5 bg-teal-800 text-white flex flex-col justify-between h-28 rounded-xl shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-bold tracking-wider text-teal-200">Demanda Estimada</span>
            <DollarSign size={16} className="text-teal-300 opacity-60" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight">
              ${portfolioValue}M <span className="text-xs font-semibold text-teal-200">COP</span>
            </div>
            <p className="text-[10px] text-teal-200 mt-0.5 font-medium">Portafolio estimado total</p>
          </div>
        </div>
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Industry Distribution & Business Sizes */}
        <div className="border border-slate-200/60 p-6 rounded-xl bg-white flex flex-col gap-5 shadow-sm">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 size={15} className="text-teal-600" /> Distribución Industrial
            </h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              Los 5 sectores con mayor presencia de prospectos en tu CRM.
            </p>
          </div>

          <div className="space-y-3.5 text-xs">
            {sortedCategories.map(([category, count]) => {
              const pct = Math.round((count / totalLeads) * 100);
              return (
                <div key={category} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="capitalize text-slate-700 font-medium">{category}</span>
                    <span className="text-slate-900">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-50">
                    <div 
                      className="bg-teal-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sizes break down */}
          <div className="border-t border-slate-100 pt-5">
            <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider">Perfil por Tamaño de Negocio</h4>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 shadow-inner">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Micropyme</span>
                <span className="text-lg font-bold text-slate-800 block mt-0.5">{sizeCounts.micro}</span>
                <span className="text-[9px] text-slate-400 font-semibold block">
                  {Math.round((sizeCounts.micro / totalLeads) * 100)}%
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 shadow-inner">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Pequeña</span>
                <span className="text-lg font-bold text-slate-800 block mt-0.5">{sizeCounts.small}</span>
                <span className="text-[9px] text-slate-400 font-semibold block">
                  {Math.round((sizeCounts.small / totalLeads) * 100)}%
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 shadow-inner">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Mediana</span>
                <span className="text-lg font-bold text-slate-800 block mt-0.5">{sizeCounts.medium}</span>
                <span className="text-[9px] text-slate-400 font-semibold block">
                  {Math.round((sizeCounts.medium / totalLeads) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sales Funnel & Credit Needs */}
        <div className="border border-slate-200/60 p-6 rounded-xl bg-white flex flex-col gap-5 shadow-sm">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Activity size={15} className="text-teal-600" /> Conversión del Pipeline CRM
            </h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              Estado y etapas del embudo de los prospectos guardados.
            </p>
          </div>

          {/* Funnel Visualizer */}
          <div className="space-y-3 text-xs">
            
            {/* Step 1: Nuevo */}
            <div className="flex items-center gap-3">
              <span className="w-16 text-right font-semibold text-slate-500 text-[10px] uppercase">Nuevos</span>
              <div className="flex-1 bg-slate-100 h-5 border border-slate-200/30 rounded-lg overflow-hidden relative">
                <div 
                  className="bg-teal-500/60 h-full flex items-center px-2.5 text-slate-900 font-bold text-[10px]" 
                  style={{ width: `${Math.max(12, (pipelineStats.nuevo / totalLeads) * 100)}%` }}
                >
                  {pipelineStats.nuevo}
                </div>
              </div>
            </div>

            {/* Step 2: Contactado */}
            <div className="flex items-center gap-3">
              <span className="w-16 text-right font-semibold text-slate-500 text-[10px] uppercase">Llamados</span>
              <div className="flex-1 bg-slate-100 h-5 border border-slate-200/30 rounded-lg overflow-hidden relative">
                <div 
                  className="bg-teal-600/70 h-full flex items-center px-2.5 text-white font-bold text-[10px]" 
                  style={{ width: `${Math.max(12, (pipelineStats.contactado / totalLeads) * 100)}%` }}
                >
                  {pipelineStats.contactado}
                </div>
              </div>
            </div>

            {/* Step 3: Interesado */}
            <div className="flex items-center gap-3">
              <span className="w-16 text-right font-semibold text-slate-500 text-[10px] uppercase">Interés</span>
              <div className="flex-1 bg-slate-100 h-5 border border-slate-200/30 rounded-lg overflow-hidden relative">
                <div 
                  className="bg-teal-700/80 h-full flex items-center px-2.5 text-white font-bold text-[10px]" 
                  style={{ width: `${Math.max(12, (pipelineStats.interesado / totalLeads) * 100)}%` }}
                >
                  {pipelineStats.interesado}
                </div>
              </div>
            </div>

            {/* Step 4: Aprobado */}
            <div className="flex items-center gap-3">
              <span className="w-16 text-right font-semibold text-slate-500 text-[10px] uppercase">Aprobados</span>
              <div className="flex-1 bg-slate-100 h-5 border border-slate-200/30 rounded-lg overflow-hidden relative">
                <div 
                  className="bg-teal-850/90 h-full flex items-center px-2.5 text-white font-bold text-[10px]" 
                  style={{ width: `${Math.max(12, (pipelineStats.aprobado / totalLeads) * 100)}%` }}
                >
                  {pipelineStats.aprobado}
                </div>
              </div>
            </div>

            {/* Step 5: Descartado */}
            <div className="flex items-center gap-3 text-slate-400">
              <span className="w-16 text-right font-semibold text-[10px] uppercase">Descartes</span>
              <div className="flex-1 bg-slate-100 h-5 border border-slate-200/20 rounded-lg overflow-hidden relative">
                <div 
                  className="bg-slate-300/40 h-full flex items-center px-2.5 text-slate-600 font-bold text-[10px]" 
                  style={{ width: `${Math.max(12, (pipelineStats.descartado / totalLeads) * 100)}%` }}
                >
                  {pipelineStats.descartado}
                </div>
              </div>
            </div>
          </div>

          {/* Credit Needs */}
          <div className="border-t border-slate-100 pt-5">
            <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider">Necesidades Crediticias Identificadas</h4>
            <div className="space-y-2 text-xs">
              {Object.entries(needCounts).map(([need, count]) => {
                const pct = Math.round((count / totalLeads) * 100);
                return (
                  <div key={need} className="flex justify-between items-center bg-slate-50 px-3.5 py-2 border border-slate-200/60 rounded-lg font-medium text-slate-700">
                    <span>{need}</span>
                    <span className="font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-100 text-[10px]">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
