import React, { useState } from "react";
import { ValidatedBusiness } from "../types";
import { exportToExcel } from "../lib/exportUtils";
import { 
  FileSpreadsheet, Search, Trash2, Edit, CheckCircle, 
  MessageSquare, User, Filter, AlertCircle, Phone, Globe, Save
} from "lucide-react";
import { cn } from "../lib/utils";

interface LeadCRMProps {
  leads: ValidatedBusiness[];
  onUpdateLead: (biz: ValidatedBusiness) => void;
  onRemoveLead: (id: string) => void;
}

const STATUS_LABELS: Record<NonNullable<ValidatedBusiness["crmStatus"]>, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  interesado: "Interesado",
  aprobado: "Crédito Aprobado",
  descartado: "Descartado"
};

const STATUS_COLORS: Record<NonNullable<ValidatedBusiness["crmStatus"]>, string> = {
  nuevo: "bg-blue-50 text-blue-700 border-blue-100",
  contactado: "bg-purple-50 text-purple-700 border-purple-100",
  interesado: "bg-amber-50 text-amber-700 border-amber-100",
  aprobado: "bg-teal-50 text-teal-700 border-teal-100",
  descartado: "bg-slate-100 text-slate-500 border-slate-200"
};

export function LeadCRM({ leads, onUpdateLead, onRemoveLead }: LeadCRMProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState("");
  const [editingStatus, setEditingStatus] = useState<ValidatedBusiness["crmStatus"]>("nuevo");

  const selectedLead = leads.find(l => l.id === selectedLeadId);

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          lead.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          lead.municipality.toLowerCase().includes(searchTerm.toLowerCase());
    
    const leadStatus = lead.crmStatus || "nuevo";
    const matchesStatus = statusFilter === "all" || leadStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleSelectLead = (lead: ValidatedBusiness) => {
    setSelectedLeadId(lead.id);
    setEditingNotes(lead.userNotes || "");
    setEditingStatus(lead.crmStatus || "nuevo");
  };

  const handleSaveChanges = () => {
    if (!selectedLead) return;
    onUpdateLead({
      ...selectedLead,
      crmStatus: editingStatus,
      userNotes: editingNotes,
      updatedAt: new Date().toISOString()
    });
  };

  const handleExportCRM = () => {
    exportToExcel(leads, `Pipeline_CRM_Prospectos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-y-auto lg:overflow-hidden p-4 md:p-5 xl:p-6 gap-4 xl:gap-6 font-body">
      
      {/* CRM Main List Panel */}
      <div className="flex-1 p-5 xl:p-6 flex flex-col overflow-hidden product-panel-raised min-w-0">
        
        {/* Header and Export Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Pipeline de Captación</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Gestiona prospectos locales y registra el avance de la prospección crediticia.
            </p>
          </div>
          
          {leads.length > 0 && (
            <button
              onClick={handleExportCRM}
              className="secondary-action flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl cursor-pointer"
            >
              <FileSpreadsheet size={14} className="text-teal-600" />
              Exportar Pipeline
            </button>
          )}
        </div>

        {/* Filters bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-5 surface-subtle p-4 rounded-2xl">
          <div className="flex-1 relative font-sans">
            <Search className="absolute left-3 top-3 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por nombre, dirección o municipio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="control-field pl-10 pr-4 py-2.5 text-xs placeholder:text-slate-400 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 font-sans">
            <Filter size={15} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="control-field px-3 py-2.5 text-xs font-medium cursor-pointer min-w-[170px]"
            >
              <option value="all">Todos los estados</option>
              <option value="nuevo">Nuevos</option>
              <option value="contactado">Contactados</option>
              <option value="interesado">Interesados</option>
              <option value="aprobado">Crédito Aprobado</option>
              <option value="descartado">Descartados</option>
            </select>
          </div>
        </div>

        {/* Leads Table / Grid */}
        <div className="flex-1 overflow-auto rounded-2xl border border-slate-100 bg-white shadow-xs custom-scrollbar">
          {filteredLeads.length > 0 ? (
            <table className="w-full text-left text-xs border-collapse data-table">
              <thead>
                <tr className="uppercase tracking-wider opacity-60 border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-600">
                  <th className="p-3.5 min-w-[200px]">Empresa</th>
                  <th className="p-3.5">Municipio</th>
                  <th className="p-3.5 text-center">Score Op.</th>
                  <th className="p-3.5">Estado CRM</th>
                  <th className="p-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map((lead) => {
                  const currentStatus = lead.crmStatus || "nuevo";
                  return (
                    <tr 
                      key={lead.id} 
                      onClick={() => handleSelectLead(lead)}
                      className={cn(
                        "hover:bg-slate-50/70 cursor-pointer transition-colors",
                        selectedLeadId === lead.id ? "bg-ink-50/70 shadow-[inset_3px_0_0_#14b8a6]" : ""
                      )}
                    >
                      <td className="p-3.5 align-top">
                        <div className="font-semibold text-slate-900 text-sm">{lead.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-medium capitalize">
                          {lead.estimatedSize === 'micro' ? 'Micropyme' : lead.estimatedSize === 'small' ? 'Pequeña' : 'Mediana'} • {lead.predictedNeed}
                        </div>
                      </td>
                      <td className="p-3.5 align-top text-slate-500 font-medium">
                        {lead.municipality}
                      </td>
                      <td className="p-3.5 text-center align-top">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1 shadow-sm mt-0.5",
                          lead.opportunityScore >= 80 ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
                          lead.opportunityScore >= 50 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-rose-700 bg-rose-50 border-rose-200"
                        )}>
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            lead.opportunityScore >= 80 ? "bg-emerald-500 animate-pulse" :
                            lead.opportunityScore >= 50 ? "bg-amber-500" : "bg-rose-500"
                          )} />
                          {lead.opportunityScore}%
                        </span>
                      </td>
                      <td className="p-3.5 align-top">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                          STATUS_COLORS[currentStatus]
                        )}>
                          {STATUS_LABELS[currentStatus]}
                        </span>
                      </td>
                      <td className="p-3.5 text-right align-top" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onRemoveLead(lead.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 border border-slate-100 hover:border-rose-200 rounded-lg transition-all inline-block cursor-pointer shadow-sm"
                          title="Eliminar de CRM"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center text-slate-300 p-8 text-center bg-white rounded-xl">
              <AlertCircle size={28} className="mb-2 text-teal-600 opacity-40 animate-pulse" />
              <p className="text-slate-800 text-xs font-bold uppercase tracking-wider">No se encontraron prospectos</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                Guarda prospectos desde la pestaña de Búsqueda y Mapa para verlos en tu base comercial.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CRM Detailed Sidebar Panel */}
      <aside className="w-full lg:w-96 p-5 xl:p-6 product-panel-raised flex flex-col overflow-y-auto custom-scrollbar flex-shrink-0">
        {selectedLead ? (
          <div className="space-y-5 font-sans">
            <div>
              <p className="section-kicker mb-2">
                Ficha del Prospecto
              </p>
              <h3 className="text-xl font-bold leading-tight text-slate-900">
                {selectedLead.name}
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-1">{selectedLead.address}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 surface-subtle p-4 rounded-2xl">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Confianza IA</span>
                <span className="font-bold text-xs text-slate-700">{selectedLead.reliabilityScore}/10</span>
              </div>
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Score Captación</span>
                <span className="font-bold text-xs text-slate-700">{selectedLead.opportunityScore}%</span>
              </div>
              <div className="mt-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Tamaño Estimado</span>
                <span className="font-bold text-xs capitalize text-slate-700">{selectedLead.estimatedSize === 'micro' ? 'Micropyme' : selectedLead.estimatedSize === 'small' ? 'Pequeña' : 'Mediana'}</span>
              </div>
              <div className="mt-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Huella Digital</span>
                <span className="font-bold text-xs capitalize text-slate-700">{selectedLead.digitalFootprint === 'low' ? 'Baja' : selectedLead.digitalFootprint === 'medium' ? 'Media' : 'Alta'}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Necesidad Financiera Estimada</span>
              <div className="text-xs font-semibold text-teal-900 border-b border-slate-100 pb-1.5 flex items-center gap-1">
                {selectedLead.predictedNeed}
              </div>
            </div>

            <div className="space-y-1.5 bg-teal-50/20 p-3 rounded-lg border border-teal-50/50 italic text-slate-600 text-xs font-serif leading-relaxed">
              <span className="text-[9px] font-sans font-bold uppercase tracking-wider text-slate-400 not-italic block mb-1">
                Descripción de Negocio
              </span>
              "{selectedLead.reasoning}"
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-3.5">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-slate-700">
                  <Phone size={13} className="text-slate-400" /> {selectedLead.phone || "No disponible"}
                </span>
                {selectedLead.website && (
                  <a 
                    href={selectedLead.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:underline text-teal-700 font-bold"
                  >
                    <Globe size={13} /> Sitio Web ↗
                  </a>
                )}
              </div>
            </div>

            {/* Editing Section */}
            <div className="space-y-4 border-t border-slate-100 pt-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Estado en Embudo Comercial
                </label>
                <select
                  value={editingStatus}
                  onChange={(e) => setEditingStatus(e.target.value as ValidatedBusiness["crmStatus"])}
                  className="control-field px-3 py-2.5 text-xs font-medium"
                >
                  <option value="nuevo">Nuevo</option>
                  <option value="contactado">Contactado</option>
                  <option value="interesado">Interesado</option>
                  <option value="aprobado">Crédito Aprobado</option>
                  <option value="descartado">Descartado</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Notas de Seguimiento del Asesor
                </label>
                <textarea
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="Detalla acuerdos de llamadas, monto requerido, contacto del dueño..."
                  rows={4}
                  className="control-field p-3 text-xs placeholder:text-slate-400 placeholder:italic resize-none leading-relaxed"
                />
              </div>

              <button
                onClick={handleSaveChanges}
                className="primary-action w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save size={13} />
                Guardar notas e historial
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center py-12">
            <User size={32} className="mb-2 opacity-40 text-teal-600" />
            <p className="text-slate-800 text-xs font-bold uppercase tracking-wider">Perfil del Prospecto</p>
            <p className="text-[10px] text-slate-400 mt-1 max-w-xs leading-relaxed font-sans">
              Selecciona un lead de la lista para ver su perfil crediticio completo, registrar notas de contacto e historial.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
