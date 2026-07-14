import React, { useState, useEffect } from "react";
import { 
  Users, 
  ClipboardList, 
  TrendingUp, 
  Download, 
  Eye, 
  Search, 
  Building2, 
  Loader2, 
  Calendar, 
  UserCheck, 
  RefreshCw, 
  MapPin, 
  Award,
  BookOpen
} from "lucide-react";
import { databaseService } from "../lib/supabase";

interface AdvisorMetric {
  id: string;
  fullName: string;
  email: string;
  assignedZones: string[];
  leadsCount: number;
  searchesCount: number;
  downloadsCount: number;
}

interface ActivityLog {
  id: number;
  user_id: string | null;
  user_email: string;
  action_type: string;
  details: string | null;
  created_at: string;
}

interface LeadAdmin {
  id: string;
  name: string;
  municipality: string;
  estimatedSize: string;
  opportunityScore: number;
  predictedNeed: string;
  crmStatus: string;
  assignedTo: string;
  assignedName: string;
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<"advisors" | "activity" | "leads">("advisors");
  const [advisorsMetrics, setAdvisorsMetrics] = useState<AdvisorMetric[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [allLeads, setAllLeads] = useState<LeadAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [metrics, logs, leads] = await Promise.all([
        databaseService.getAdvisorsMetrics(),
        databaseService.getActivityLogs(),
        databaseService.getAllLeads()
      ]);
      setAdvisorsMetrics(metrics);
      setActivityLogs(logs);
      setAllLeads(leads);
    } catch (err) {
      console.error("Error al cargar datos del panel de administración:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute stats
  const totalAdvisors = advisorsMetrics.length;
  const totalSearches = activityLogs.filter(l => l.action_type === "SEARCH").length;
  const totalDownloads = activityLogs.filter(l => l.action_type === "DOWNLOAD_EXCEL").length;
  const totalLeads = allLeads.length;

  // Filter logs
  const filteredLogs = activityLogs.filter(log => {
    const matchesSearch = log.user_email.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesAction = actionFilter === "ALL" || log.action_type === actionFilter;
    return matchesSearch && matchesAction;
  });

  // Filter leads
  const filteredLeads = allLeads.filter(lead => {
    return lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.assignedName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.municipality.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-100 shadow-sm min-h-[450px]">
        <Loader2 className="animate-spin text-teal-600 mb-4" size={36} />
        <p className="text-slate-500 font-semibold tracking-wide text-sm uppercase">Cargando datos de administración...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Cards KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Asesores Activos</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{totalAdvisors}</h3>
          </div>
          <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Búsquedas Realizadas</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{totalSearches}</h3>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Search size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Descargas Excel</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{totalDownloads}</h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Download size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Leads Identificados</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{totalLeads}</h3>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Building2 size={20} />
          </div>
        </div>
      </div>

      {/* Tabs and Refresh Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex bg-slate-100 p-1.5 rounded-xl w-full md:w-auto">
          <button
            onClick={() => { setActiveTab("advisors"); setSearchQuery(""); }}
            className={`flex-1 md:flex-initial px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "advisors" 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <UserCheck size={14} />
            Métricas Asesores
          </button>
          <button
            onClick={() => { setActiveTab("activity"); setSearchQuery(""); }}
            className={`flex-1 md:flex-initial px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "activity" 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <ClipboardList size={14} />
            Bitácora de Uso
          </button>
          <button
            onClick={() => { setActiveTab("leads"); setSearchQuery(""); }}
            className={`flex-1 md:flex-initial px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "leads" 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building2 size={14} />
            Leads del CRM
          </button>
        </div>

        <button
          onClick={loadData}
          className="w-full md:w-auto border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold py-2 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          <RefreshCw size={12} />
          Actualizar Panel
        </button>
      </div>

      {/* Main View Area */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        
        {/* Table Filter Headers for Activity and Leads */}
        {activeTab !== "advisors" && (
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/20">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3.5 top-3.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder={activeTab === "activity" ? "Buscar por usuario o detalle..." : "Buscar pyme, zona o asesor..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all placeholder-slate-400 font-medium"
              />
            </div>

            {activeTab === "activity" && (
              <div className="flex items-center gap-2 w-full md:w-auto">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Acción:</span>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-teal-500 transition-all font-semibold text-slate-700 shadow-sm"
                >
                  <option value="ALL">Todas las acciones</option>
                  <option value="LOGIN">Inicios de sesión (LOGIN)</option>
                  <option value="SEARCH">Búsquedas (SEARCH)</option>
                  <option value="DOWNLOAD_EXCEL">Descargas Excel (DOWNLOAD_EXCEL)</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* Tab 1: Advisors Metrics */}
        {activeTab === "advisors" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="uppercase tracking-wider opacity-60 border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-600">
                  <th className="p-4 pl-6">Asesor</th>
                  <th className="p-4">Zonas Asignadas</th>
                  <th className="p-4 text-center">Búsquedas</th>
                  <th className="p-4 text-center">Descargas Excel</th>
                  <th className="p-4 text-center">Prospectos en CRM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {advisorsMetrics.length > 0 ? (
                  advisorsMetrics.map((advisor) => (
                    <tr key={advisor.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="p-4 pl-6 font-semibold">
                        <div className="text-slate-900 font-bold text-sm">{advisor.fullName}</div>
                        <div className="text-slate-400 font-mono text-[10.5px] mt-0.5">{advisor.email}</div>
                      </td>
                      <td className="p-4 max-w-[280px]">
                        <div className="flex flex-wrap gap-1">
                          {advisor.assignedZones.length > 0 ? (
                            advisor.assignedZones.map((z, idx) => (
                              <span key={idx} className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 flex items-center gap-0.5">
                                <MapPin size={8} /> {z}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">Ninguna zona asignada</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center font-bold text-slate-900">{advisor.searchesCount}</td>
                      <td className="p-4 text-center font-bold text-slate-900">
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                          {advisor.downloadsCount} descargas
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 font-bold">
                          {advisor.leadsCount} leads
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 italic">No hay asesores comerciales registrados en la base de datos.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Activity Logs */}
        {activeTab === "activity" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="uppercase tracking-wider opacity-60 border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-600">
                  <th className="p-4 pl-6">Fecha / Hora</th>
                  <th className="p-4">Usuario</th>
                  <th className="p-4">Acción</th>
                  <th className="p-4">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => {
                    const localDate = new Date(log.created_at).toLocaleString("es-CO", {
                      timeZone: "America/Bogota"
                    });
                    
                    let actionBadge = "";
                    if (log.action_type === "LOGIN") actionBadge = "text-indigo-700 bg-indigo-50 border-indigo-100";
                    else if (log.action_type === "SEARCH") actionBadge = "text-teal-700 bg-teal-50 border-teal-100";
                    else if (log.action_type === "DOWNLOAD_EXCEL") actionBadge = "text-emerald-700 bg-emerald-50 border-emerald-100";
                    else actionBadge = "text-slate-700 bg-slate-50 border-slate-200";

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="p-4 pl-6 text-slate-500 font-medium whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <Calendar size={11} className="text-slate-300" />
                            {localDate}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-800">{log.user_email}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 border rounded-full text-[9px] uppercase tracking-wider font-bold ${actionBadge}`}>
                            {log.action_type}
                          </span>
                        </td>
                        <td className="p-4 text-slate-600 font-mono text-[10px] max-w-sm truncate" title={log.details || ""}>
                          {log.details || "-"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400 italic">No se encontraron registros en la bitácora que coincidan con la búsqueda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: CRM Leads (All advisors) */}
        {activeTab === "leads" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="uppercase tracking-wider opacity-60 border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-600">
                  <th className="p-4 pl-6">Pyme / Negocio</th>
                  <th className="p-4">Municipio</th>
                  <th className="p-4 text-center">Score</th>
                  <th className="p-4">Estado CRM</th>
                  <th className="p-4">Asignado A</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredLeads.length > 0 ? (
                  filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="font-bold text-slate-900 text-sm">{lead.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 font-semibold uppercase">
                          <span>{lead.estimatedSize}</span>
                          <span>•</span>
                          <span className="text-teal-600 font-mono">{lead.predictedNeed}</span>
                        </div>
                      </td>
                      <td className="p-4 font-bold text-slate-500 capitalize">{lead.municipality.toLowerCase()}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          lead.opportunityScore >= 80 ? "text-emerald-700 bg-emerald-50 border-emerald-100" :
                          lead.opportunityScore >= 50 ? "text-amber-700 bg-amber-50 border-amber-100" : "text-rose-700 bg-rose-50 border-rose-100"
                        }`}>
                          {lead.opportunityScore}%
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wide font-black border ${
                          lead.crmStatus === "aprobado" ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
                          lead.crmStatus === "interesado" ? "text-indigo-700 bg-indigo-50 border-indigo-200" :
                          lead.crmStatus === "contactado" ? "text-amber-700 bg-amber-50 border-amber-200" :
                          lead.crmStatus === "descartado" ? "text-rose-700 bg-rose-50 border-rose-200" : "text-slate-600 bg-slate-100 border-slate-200"
                        }`}>
                          {lead.crmStatus}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-slate-900">{lead.assignedName}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 italic">No se encontraron leads comerciales que coincidan con la búsqueda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
