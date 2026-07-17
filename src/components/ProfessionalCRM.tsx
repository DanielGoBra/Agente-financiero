import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Columns3,
  FileSpreadsheet,
  List,
  Loader2,
  Mail,
  MapPin,
  MessageSquarePlus,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Target,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import type { UserProfile, ValidatedBusiness } from "../types";
import type {
  CRMAccount,
  CRMActivity,
  CRMActivityType,
  CRMContact,
  CRMPipelineKind,
  CRMPriority,
  CRMStageHistory,
  CRMTask,
  CRMWorkspace,
} from "../types/crm";
import { databaseService } from "../lib/supabase";
import { crmStageToLegacyStatus } from "../lib/crmMappings";
import { exportToExcel } from "../lib/exportUtils";
import { cn } from "../lib/utils";
import { LeadCRM } from "./LeadCRM";

interface ProfessionalCRMProps {
  currentUser: UserProfile;
  leads: ValidatedBusiness[];
  onUpdateLead: (lead: ValidatedBusiness) => void | Promise<void>;
  onRemoveLead: (id: string) => void | Promise<void>;
}

type ViewMode = "kanban" | "list";

const PRIORITY_LABELS: Record<CRMPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const ACTIVITY_LABELS: Record<CRMActivityType, string> = {
  call: "Llamada",
  email: "Correo",
  whatsapp: "WhatsApp",
  meeting: "Reunión",
  visit: "Visita",
  note: "Nota",
  status_change: "Cambio de etapa",
  task_completed: "Tarea completada",
  system: "Sistema",
};

const ACTIVITY_OPTIONS: CRMActivityType[] = ["call", "whatsapp", "email", "meeting", "visit", "note"];

function formatDate(value: string | null, includeTime = true): string {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function accountLead(account: CRMAccount, leads: ValidatedBusiness[]): ValidatedBusiness | undefined {
  return leads.find(lead => {
    if (account.legacyEmpresaId !== null && /^\d+$/.test(lead.id)) {
      return Number(lead.id) === account.legacyEmpresaId;
    }
    return Boolean(account.googlePlaceId) && lead.id === account.googlePlaceId;
  });
}

function priorityClass(priority: CRMPriority): string {
  if (priority === "urgent") return "bg-rose-50 text-rose-700 border-rose-200";
  if (priority === "high") return "bg-amber-50 text-amber-700 border-amber-200";
  if (priority === "low") return "bg-slate-50 text-slate-500 border-slate-200";
  return "bg-teal-50 text-teal-700 border-teal-200";
}

export function ProfessionalCRM({ currentUser, leads, onUpdateLead, onRemoveLead }: ProfessionalCRMProps) {
  const [workspace, setWorkspace] = useState<CRMWorkspace | null>(null);
  const [useLegacyCRM, setUseLegacyCRM] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [pipelineKind, setPipelineKind] = useState<Exclude<CRMPipelineKind, "terminal">>("lead");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activities, setActivities] = useState<CRMActivity[]>([]);
  const [stageHistory, setStageHistory] = useState<CRMStageHistory[]>([]);
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [actionBusy, setActionBusy] = useState(false);

  const [activityType, setActivityType] = useState<CRMActivityType>("call");
  const [activityBody, setActivityBody] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskPriority, setTaskPriority] = useState<CRMPriority>("medium");
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    databaseService.prepareProfessionalCRM(currentUser.id, leads)
      .then(result => {
        if (!active) return;
        if (!result.available) {
          setUseLegacyCRM(true);
          setWorkspace(null);
          return;
        }
        setUseLegacyCRM(false);
        setWorkspace(result);
        setSelectedAccountId(current => {
          if (current && result.accounts.some(account => account.id === current)) return current;
          return result.accounts[0]?.id || null;
        });
      })
      .catch(cause => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "No se pudo preparar el CRM profesional.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUser.id, leads, reloadKey]);

  const selectedAccount = workspace?.accounts.find(account => account.id === selectedAccountId) || null;
  const selectedLead = selectedAccount ? accountLead(selectedAccount, leads) : undefined;

  const loadAccountDetails = async (accountId: string) => {
    setDetailsLoading(true);
    setError("");
    try {
      const [activityRows, historyRows, contactRows] = await Promise.all([
        databaseService.getCRMActivities(accountId),
        databaseService.getCRMStageHistory(accountId),
        databaseService.getCRMContacts(accountId),
      ]);
      setActivities(activityRows);
      setStageHistory(historyRows);
      setContacts(contactRows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar la vista 360°.");
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedAccountId || useLegacyCRM) {
      setActivities([]);
      setStageHistory([]);
      setContacts([]);
      return;
    }
    void loadAccountDetails(selectedAccountId);
  }, [selectedAccountId, useLegacyCRM]);

  const stageMap = useMemo(
    () => new Map((workspace?.stages || []).map(stage => [stage.id, stage])),
    [workspace?.stages]
  );

  const visibleStages = useMemo(
    () => (workspace?.stages || [])
      .filter(stage => stage.pipeline === pipelineKind)
      .sort((a, b) => a.position - b.position),
    [workspace?.stages, pipelineKind]
  );

  const visibleStageIds = useMemo(() => new Set(visibleStages.map(stage => stage.id)), [visibleStages]);

  const filteredAccounts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return (workspace?.accounts || []).filter(account => {
      const matchesPipeline = visibleStageIds.has(account.stageId);
      const matchesSearch = !normalizedSearch
        || account.displayName.toLowerCase().includes(normalizedSearch)
        || account.municipality.toLowerCase().includes(normalizedSearch)
        || account.phone.toLowerCase().includes(normalizedSearch);
      return matchesPipeline && matchesSearch;
    });
  }, [workspace?.accounts, searchTerm, visibleStageIds]);

  const pendingTasks = (workspace?.tasks || []).filter(task => task.status === "pending" || task.status === "in_progress");
  const overdueTasks = pendingTasks.filter(task => task.dueAt && new Date(task.dueAt).getTime() < Date.now());
  const accountsWithTasks = new Set(pendingTasks.map(task => task.accountId));
  const accountsWithoutAction = (workspace?.accounts || []).filter(account => !accountsWithTasks.has(account.id)).length;
  const terminalStageIds = new Set((workspace?.stages || []).filter(stage => stage.pipeline === "terminal").map(stage => stage.id));
  const activeAccounts = (workspace?.accounts || []).filter(account => !terminalStageIds.has(account.stageId)).length;

  const selectedTasks = (workspace?.tasks || []).filter(task => task.accountId === selectedAccountId);

  const timeline = useMemo(() => {
    const activityItems = activities.map(activity => ({
      id: `activity-${activity.id}`,
      date: activity.occurredAt,
      title: activity.subject || ACTIVITY_LABELS[activity.activityType],
      body: activity.body,
      kind: activity.activityType,
    }));
    const historyItems = stageHistory.map(history => ({
      id: `history-${history.id}`,
      date: history.createdAt,
      title: "Cambio de etapa",
      body: `${history.fromStageId ? stageMap.get(history.fromStageId)?.name || history.fromStageId : "Inicio"} → ${stageMap.get(history.toStageId)?.name || history.toStageId}`,
      kind: "status_change" as CRMActivityType,
    }));
    return [...activityItems, ...historyItems]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activities, stageHistory, stageMap]);

  const handleStageChange = async (stageId: string) => {
    if (!workspace || !selectedAccount) return;
    const previousStageId = selectedAccount.stageId;
    if (stageId === previousStageId) return;
    setActionBusy(true);
    setError("");
    try {
      await databaseService.updateCRMAccountStage(selectedAccount.id, stageId);
      try {
        if (selectedLead) {
          await onUpdateLead({
            ...selectedLead,
            crmStatus: crmStageToLegacyStatus(stageId),
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (legacyError) {
        await databaseService.updateCRMAccountStage(selectedAccount.id, previousStageId);
        throw legacyError;
      }

      setWorkspace(current => current ? {
        ...current,
        accounts: current.accounts.map(account => account.id === selectedAccount.id
          ? { ...account, stageId, updatedAt: new Date().toISOString() }
          : account),
      } : current);
      await loadAccountDetails(selectedAccount.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cambiar la etapa.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleCreateActivity = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedAccount || !activityBody.trim()) return;
    setActionBusy(true);
    setError("");
    try {
      const activity = await databaseService.createCRMActivity({
        accountId: selectedAccount.id,
        userId: currentUser.id,
        activityType,
        subject: ACTIVITY_LABELS[activityType],
        body: activityBody.trim(),
      });
      setActivities(current => [activity, ...current]);
      setActivityBody("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar la actividad.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleCreateTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedAccount || !taskTitle.trim()) return;
    setActionBusy(true);
    setError("");
    try {
      const task = await databaseService.createCRMTask({
        accountId: selectedAccount.id,
        userId: currentUser.id,
        title: taskTitle.trim(),
        priority: taskPriority,
        dueAt: taskDueAt ? new Date(taskDueAt).toISOString() : undefined,
      });
      setWorkspace(current => current ? { ...current, tasks: [...current.tasks, task] } : current);
      setTaskTitle("");
      setTaskDueAt("");
      setTaskPriority("medium");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear la tarea.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleCompleteTask = async (task: CRMTask) => {
    setActionBusy(true);
    setError("");
    try {
      await databaseService.updateCRMTaskStatus(task.id, "completed");
      const refreshedTasks = await databaseService.getCRMTasks();
      setWorkspace(current => current ? { ...current, tasks: refreshedTasks } : current);
      if (selectedAccountId) await loadAccountDetails(selectedAccountId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la tarea.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleCreateContact = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedAccount || !contactName.trim() || (!contactPhone.trim() && !contactEmail.trim())) return;
    setActionBusy(true);
    setError("");
    try {
      const contact = await databaseService.createCRMContact({
        accountId: selectedAccount.id,
        userId: currentUser.id,
        fullName: contactName.trim(),
        jobTitle: contactRole.trim(),
        phone: contactPhone.trim(),
        email: contactEmail.trim(),
        isPrimary: contacts.length === 0,
      });
      setContacts(current => [...current, contact]);
      setContactName("");
      setContactRole("");
      setContactPhone("");
      setContactEmail("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el contacto.");
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="product-panel-raised px-8 py-7 text-center">
          <Loader2 size={26} className="animate-spin text-ink-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800">Preparando centro de ventas</p>
          <p className="text-xs text-slate-400 mt-1">Sincronizando pipeline, tareas y actividad comercial.</p>
        </div>
      </div>
    );
  }

  if (useLegacyCRM) {
    return <LeadCRM leads={leads} onUpdateLead={onUpdateLead} onRemoveLead={onRemoveLead} />;
  }

  if (!workspace) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg product-panel-raised p-7 text-center">
          <AlertCircle className="text-rose-500 mx-auto mb-3" size={28} />
          <h2 className="text-lg font-bold text-slate-900">No se pudo iniciar el CRM profesional</h2>
          <p className="text-xs text-slate-500 mt-2">{error || "Verifica la conexión con Supabase e intenta nuevamente."}</p>
          <div className="mt-5 flex justify-center gap-2">
            <button onClick={() => setReloadKey(key => key + 1)} className="primary-action px-4 py-2.5 text-xs rounded-xl flex items-center gap-2">
              <RefreshCw size={14} /> Reintentar
            </button>
            <button onClick={() => setUseLegacyCRM(true)} className="secondary-action px-4 py-2.5 text-xs rounded-xl">Usar CRM actual</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto xl:overflow-hidden p-4 md:p-5 xl:p-6 font-body">
      <div className="h-full min-h-0 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="section-kicker">CRM operativo</span>
              <span className="px-2 py-0.5 rounded-full bg-ink-50 border border-ink-100 text-[9px] uppercase tracking-wider font-bold text-ink-700">Lead 360°</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Centro de ventas</h2>
            <p className="text-xs text-slate-400 mt-1">Gestiona prioridades, próximas acciones y conversaciones desde un solo lugar.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportToExcel(leads, `Pipeline_CRM_${new Date().toISOString().split("T")[0]}.xlsx`)}
              className="secondary-action px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2"
            >
              <FileSpreadsheet size={14} /> Exportar
            </button>
            <button onClick={() => setReloadKey(key => key + 1)} className="secondary-action p-2.5 rounded-xl" aria-label="Actualizar CRM">
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-start gap-3 text-xs text-rose-700">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError("")} aria-label="Cerrar alerta"><X size={14} /></button>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Cartera activa", value: activeAccounts, hint: "empresas en gestión", icon: BriefcaseBusiness, tone: "text-ink-700 bg-ink-50" },
            { label: "Tareas abiertas", value: pendingTasks.length, hint: "próximas acciones", icon: CalendarClock, tone: "text-blue-700 bg-blue-50" },
            { label: "Vencidas", value: overdueTasks.length, hint: "requieren atención", icon: Clock3, tone: overdueTasks.length ? "text-rose-700 bg-rose-50" : "text-slate-600 bg-slate-50" },
            { label: "Sin próxima acción", value: accountsWithoutAction, hint: "leads por organizar", icon: Target, tone: accountsWithoutAction ? "text-amber-700 bg-amber-50" : "text-slate-600 bg-slate-50" },
          ].map(metric => (
            <div key={metric.label} className="metric-card p-4 flex items-center gap-3 min-h-24">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", metric.tone)}><metric.icon size={18} /></div>
              <div>
                <p className="text-[9px] uppercase tracking-wider font-bold text-slate-400">{metric.label}</p>
                <p className="text-2xl font-bold text-slate-900 leading-tight">{metric.value}</p>
                <p className="text-[10px] text-slate-400">{metric.hint}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="surface-subtle rounded-2xl p-3 flex flex-col lg:flex-row gap-3 justify-between">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative min-w-0 sm:w-72">
              <Search size={15} className="absolute left-3 top-3 text-slate-400" />
              <input
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Buscar empresa, municipio o teléfono..."
                className="control-field pl-9 pr-3 py-2.5 text-xs"
              />
            </div>
            <div className="flex bg-white border border-slate-200 rounded-xl p-1">
              <button onClick={() => setPipelineKind("lead")} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold", pipelineKind === "lead" ? "bg-ink-700 text-white" : "text-slate-500")}>Captación</button>
              <button onClick={() => setPipelineKind("opportunity")} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold", pipelineKind === "opportunity" ? "bg-ink-700 text-white" : "text-slate-500")}>Oportunidades</button>
            </div>
          </div>
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 self-start">
            <button onClick={() => setViewMode("kanban")} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5", viewMode === "kanban" ? "bg-slate-900 text-white" : "text-slate-500")}><Columns3 size={13} /> Kanban</button>
            <button onClick={() => setViewMode("list")} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5", viewMode === "list" ? "bg-slate-900 text-white" : "text-slate-500")}><List size={13} /> Lista</button>
          </div>
        </div>

        <div className="flex-1 min-h-[520px] xl:min-h-0 flex flex-col xl:flex-row gap-4 overflow-visible xl:overflow-hidden">
          <section className="flex-1 min-w-0 product-panel-raised p-3 overflow-hidden">
            {viewMode === "kanban" ? (
              <div className="h-full overflow-x-auto custom-scrollbar">
                <div className="h-full flex gap-3 min-w-max">
                  {visibleStages.map(stage => {
                    const stageAccounts = filteredAccounts.filter(account => account.stageId === stage.id);
                    return (
                      <div key={stage.id} className="w-72 flex-shrink-0 bg-slate-50/80 border border-slate-100 rounded-2xl p-3 flex flex-col min-h-[430px]">
                        <div className="flex items-center justify-between mb-3 px-1">
                          <div className="flex items-center gap-2">
                            <CircleDot size={14} className="text-ink-600" />
                            <h3 className="text-xs font-bold text-slate-700">{stage.name}</h3>
                          </div>
                          <span className="w-6 h-6 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-500 flex items-center justify-center">{stageAccounts.length}</span>
                        </div>
                        <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1">
                          {stageAccounts.map(account => {
                            const lead = accountLead(account, leads);
                            const nextTask = pendingTasks.find(task => task.accountId === account.id);
                            return (
                              <button
                                key={account.id}
                                onClick={() => setSelectedAccountId(account.id)}
                                className={cn(
                                  "w-full text-left bg-white rounded-xl border p-3.5 transition-all hover:border-ink-200 hover:shadow-soft",
                                  selectedAccountId === account.id ? "border-ink-400 shadow-soft ring-1 ring-ink-100" : "border-slate-100"
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-bold text-slate-800 leading-snug line-clamp-2">{account.displayName}</p>
                                  <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1"><MapPin size={11} /> {account.municipality || "Sin municipio"}</p>
                                <div className="flex items-center justify-between mt-3">
                                  <span className={cn("px-2 py-0.5 rounded-full border text-[9px] font-bold", priorityClass(account.priority))}>{PRIORITY_LABELS[account.priority]}</span>
                                  <span className="text-[10px] font-bold text-ink-700">{lead?.opportunityScore ?? account.dataConfidence ?? 0}%</span>
                                </div>
                                {nextTask && (
                                  <div className={cn("mt-3 pt-2.5 border-t text-[9px] flex items-center gap-1.5", nextTask.dueAt && new Date(nextTask.dueAt).getTime() < Date.now() ? "text-rose-600 border-rose-100" : "text-slate-400 border-slate-100")}>
                                    <CalendarClock size={11} /> {nextTask.title} · {formatDate(nextTask.dueAt, false)}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                          {stageAccounts.length === 0 && <p className="text-[10px] text-slate-400 text-center py-8 border border-dashed border-slate-200 rounded-xl">Sin empresas en esta etapa</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-full overflow-auto custom-scrollbar rounded-xl border border-slate-100">
                <table className="w-full text-left text-xs min-w-[760px]">
                  <thead className="sticky top-0 bg-slate-50 text-[9px] uppercase tracking-wider text-slate-400 z-10">
                    <tr><th className="p-3.5">Empresa</th><th className="p-3.5">Etapa</th><th className="p-3.5">Prioridad</th><th className="p-3.5">Próxima acción</th><th className="p-3.5">Score</th><th className="p-3.5"></th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAccounts.map(account => {
                      const lead = accountLead(account, leads);
                      const nextTask = pendingTasks.find(task => task.accountId === account.id);
                      return (
                        <tr key={account.id} className={cn("hover:bg-ink-50/40", selectedAccountId === account.id && "bg-ink-50/70")}>
                          <td className="p-3.5"><p className="font-bold text-slate-800">{account.displayName}</p><p className="text-[10px] text-slate-400">{account.municipality}</p></td>
                          <td className="p-3.5 text-slate-600">{stageMap.get(account.stageId)?.name || account.stageId}</td>
                          <td className="p-3.5"><span className={cn("px-2 py-1 rounded-full border text-[9px] font-bold", priorityClass(account.priority))}>{PRIORITY_LABELS[account.priority]}</span></td>
                          <td className="p-3.5 text-slate-500">{nextTask ? `${nextTask.title} · ${formatDate(nextTask.dueAt, false)}` : "Sin próxima acción"}</td>
                          <td className="p-3.5 font-bold text-ink-700">{lead?.opportunityScore ?? account.dataConfidence ?? 0}%</td>
                          <td className="p-3.5"><button onClick={() => setSelectedAccountId(account.id)} className="secondary-action p-2 rounded-lg" aria-label={`Abrir ${account.displayName}`}><ChevronRight size={13} /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="xl:w-[430px] flex-shrink-0 product-panel-raised overflow-hidden flex flex-col min-h-[620px] xl:min-h-0">
            {selectedAccount ? (
              <>
                <div className="p-5 border-b border-slate-100 bg-gradient-to-br from-white to-ink-50/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="section-kicker mb-1">Ficha 360°</p>
                      <h3 className="text-lg font-bold text-slate-900 leading-tight">{selectedAccount.displayName}</h3>
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1"><MapPin size={11} /> {selectedAccount.address || selectedAccount.municipality || "Ubicación no disponible"}</p>
                    </div>
                    {actionBusy && <Loader2 size={16} className="animate-spin text-ink-600" />}
                  </div>
                  <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-400 mt-4 mb-1.5">Etapa actual</label>
                  <select
                    value={selectedAccount.stageId}
                    onChange={event => void handleStageChange(event.target.value)}
                    disabled={actionBusy}
                    className="control-field px-3 py-2.5 text-xs font-bold text-slate-700"
                  >
                    {["lead", "opportunity", "terminal"].map(kind => (
                      <optgroup key={kind} label={kind === "lead" ? "Captación" : kind === "opportunity" ? "Oportunidad" : "Cierre"}>
                        {workspace.stages.filter(stage => stage.pipeline === kind).map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="bg-white/80 border border-slate-100 rounded-xl p-2.5"><p className="text-[8px] uppercase font-bold text-slate-400">Score</p><p className="text-sm font-bold text-ink-700">{selectedLead?.opportunityScore ?? selectedAccount.dataConfidence ?? 0}%</p></div>
                    <div className="bg-white/80 border border-slate-100 rounded-xl p-2.5"><p className="text-[8px] uppercase font-bold text-slate-400">Confianza</p><p className="text-sm font-bold text-slate-700">{selectedAccount.dataConfidence ?? 0}%</p></div>
                    <div className="bg-white/80 border border-slate-100 rounded-xl p-2.5"><p className="text-[8px] uppercase font-bold text-slate-400">Prioridad</p><p className="text-sm font-bold text-slate-700">{PRIORITY_LABELS[selectedAccount.priority]}</p></div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                  <section>
                    <div className="flex items-center justify-between mb-3"><h4 className="text-xs font-bold text-slate-800 flex items-center gap-2"><UserRound size={14} className="text-ink-600" /> Contactabilidad</h4></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
                      <a href={selectedAccount.phone ? `tel:${selectedAccount.phone}` : undefined} className={cn("surface-subtle rounded-xl px-3 py-2.5 flex items-center gap-2 text-[11px]", !selectedAccount.phone && "pointer-events-none text-slate-400")}><Phone size={13} /> {selectedAccount.phone || "Sin teléfono"}</a>
                      <a href={selectedAccount.website ? (selectedAccount.website.includes("@") && !selectedAccount.website.startsWith("http") ? `mailto:${selectedAccount.website}` : selectedAccount.website) : undefined} className={cn("surface-subtle rounded-xl px-3 py-2.5 flex items-center gap-2 text-[11px] truncate", !selectedAccount.website && "pointer-events-none text-slate-400")}><Mail size={13} /> {selectedAccount.website || "Sin correo o sitio"}</a>
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center justify-between mb-3"><h4 className="text-xs font-bold text-slate-800 flex items-center gap-2"><CalendarClock size={14} className="text-blue-600" /> Próximas acciones</h4><span className="text-[9px] font-bold text-slate-400">{selectedTasks.filter(task => task.status !== "completed").length} abiertas</span></div>
                    <div className="space-y-2 mb-3">
                      {selectedTasks.filter(task => task.status !== "completed").map(task => (
                        <div key={task.id} className="border border-slate-100 rounded-xl p-3 flex items-start gap-3 bg-white">
                          <button onClick={() => void handleCompleteTask(task)} disabled={actionBusy} className="w-6 h-6 rounded-full border border-slate-300 hover:border-ink-500 hover:bg-ink-50 flex items-center justify-center flex-shrink-0" aria-label={`Completar ${task.title}`}><Check size={12} className="text-transparent hover:text-ink-600" /></button>
                          <div className="min-w-0 flex-1"><p className="text-[11px] font-bold text-slate-700">{task.title}</p><p className={cn("text-[9px] mt-1", task.dueAt && new Date(task.dueAt).getTime() < Date.now() ? "text-rose-600" : "text-slate-400")}>{formatDate(task.dueAt)} · {PRIORITY_LABELS[task.priority]}</p></div>
                        </div>
                      ))}
                      {selectedTasks.filter(task => task.status !== "completed").length === 0 && <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">Este lead no tiene una próxima acción.</p>}
                    </div>
                    <form onSubmit={handleCreateTask} className="surface-subtle rounded-xl p-3 space-y-2">
                      <input value={taskTitle} onChange={event => setTaskTitle(event.target.value)} placeholder="Nueva tarea o próxima acción" className="control-field px-3 py-2 text-[11px]" required />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="datetime-local" value={taskDueAt} onChange={event => setTaskDueAt(event.target.value)} className="control-field px-2 py-2 text-[10px]" />
                        <select value={taskPriority} onChange={event => setTaskPriority(event.target.value as CRMPriority)} className="control-field px-2 py-2 text-[10px]">
                          {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </div>
                      <button disabled={actionBusy || !taskTitle.trim()} className="primary-action w-full py-2 rounded-lg text-[10px] flex justify-center items-center gap-1.5"><Plus size={12} /> Crear tarea</button>
                    </form>
                  </section>

                  <section>
                    <div className="flex items-center justify-between mb-3"><h4 className="text-xs font-bold text-slate-800 flex items-center gap-2"><UsersRound size={14} className="text-violet-600" /> Contactos</h4><span className="text-[9px] font-bold text-slate-400">{contacts.length}</span></div>
                    <div className="space-y-2 mb-3">
                      {contacts.map(contact => (
                        <div key={contact.id} className="border border-slate-100 rounded-xl p-3 bg-white">
                          <div className="flex items-start justify-between"><div><p className="text-[11px] font-bold text-slate-700">{contact.fullName}</p><p className="text-[9px] text-slate-400">{contact.jobTitle || "Contacto comercial"}</p></div>{contact.isPrimary && <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[8px] font-bold">Principal</span>}</div>
                          <div className="flex gap-3 mt-2 text-[9px] text-slate-500">{contact.phone && <span className="flex items-center gap-1"><Phone size={10} />{contact.phone}</span>}{contact.email && <span className="flex items-center gap-1 truncate"><Mail size={10} />{contact.email}</span>}</div>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={handleCreateContact} className="surface-subtle rounded-xl p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2"><input value={contactName} onChange={event => setContactName(event.target.value)} placeholder="Nombre" className="control-field px-3 py-2 text-[10px]" required /><input value={contactRole} onChange={event => setContactRole(event.target.value)} placeholder="Cargo" className="control-field px-3 py-2 text-[10px]" /></div>
                      <div className="grid grid-cols-2 gap-2"><input value={contactPhone} onChange={event => setContactPhone(event.target.value)} placeholder="Teléfono" className="control-field px-3 py-2 text-[10px]" /><input type="email" value={contactEmail} onChange={event => setContactEmail(event.target.value)} placeholder="Correo" className="control-field px-3 py-2 text-[10px]" /></div>
                      <button disabled={actionBusy || !contactName.trim() || (!contactPhone.trim() && !contactEmail.trim())} className="secondary-action w-full py-2 rounded-lg text-[10px] flex justify-center items-center gap-1.5"><Plus size={12} /> Añadir contacto</button>
                    </form>
                  </section>

                  <section>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2 mb-3"><Activity size={14} className="text-ink-600" /> Línea de tiempo</h4>
                    <form onSubmit={handleCreateActivity} className="surface-subtle rounded-xl p-3 space-y-2 mb-4">
                      <div className="flex gap-2"><select value={activityType} onChange={event => setActivityType(event.target.value as CRMActivityType)} className="control-field px-2 py-2 text-[10px] w-32">{ACTIVITY_OPTIONS.map(type => <option key={type} value={type}>{ACTIVITY_LABELS[type]}</option>)}</select><input value={activityBody} onChange={event => setActivityBody(event.target.value)} placeholder="Resultado de la gestión..." className="control-field px-3 py-2 text-[10px] flex-1" required /></div>
                      <button disabled={actionBusy || !activityBody.trim()} className="primary-action w-full py-2 rounded-lg text-[10px] flex justify-center items-center gap-1.5"><MessageSquarePlus size={12} /> Registrar gestión</button>
                    </form>
                    {detailsLoading ? <Loader2 size={18} className="animate-spin text-ink-600 mx-auto my-8" /> : (
                      <div className="relative pl-5 space-y-4 before:absolute before:left-[6px] before:top-1 before:bottom-1 before:w-px before:bg-slate-200">
                        {timeline.map(item => (
                          <div key={item.id} className="relative">
                            <span className="absolute -left-5 top-1 w-3 h-3 rounded-full bg-white border-2 border-ink-500" />
                            <p className="text-[10px] font-bold text-slate-700">{item.title}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{item.body}</p>
                            <p className="text-[8px] text-slate-400 mt-1">{formatDate(item.date)}</p>
                          </div>
                        ))}
                        {timeline.length === 0 && <p className="text-[10px] text-slate-400">Aún no hay actividad registrada.</p>}
                      </div>
                    )}
                  </section>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <BriefcaseBusiness size={30} className="text-slate-300 mb-3" />
                <h3 className="text-sm font-bold text-slate-700">Selecciona una empresa</h3>
                <p className="text-[10px] text-slate-400 mt-1">Abre una tarjeta para consultar su vista 360°.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
