import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { UserProfile, ValidatedBusiness } from "../types";
import type {
  CRMAccount,
  CRMActivity,
  CRMActivityType,
  CRMContact,
  CRMConsentStatus,
  CRMPipelineStage,
  CRMPriority,
  CRMStageHistory,
  CRMTask,
  CRMTaskStatus,
  CRMWorkspace,
} from "../types/crm";
import { legacyStatusToCRMStage } from "./crmMappings";

let supabaseClient: SupabaseClient | null = null;

function inferDigitalFootprint(website: unknown, phone: unknown): ValidatedBusiness["digitalFootprint"] {
  if (typeof website === "string" && website.trim()) return "high";
  if (typeof phone === "string" && phone.trim()) return "medium";
  return "low";
}

function isProfessionalCRMUnavailable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return ["42P01", "PGRST204", "PGRST205"].includes(error.code || "")
    || /crm_(accounts|pipeline_stages|contacts)/i.test(error.message || "")
      && /not found|does not exist|schema cache/i.test(error.message || "");
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function mapPipelineStage(row: any): CRMPipelineStage {
  return {
    id: asString(row.id),
    name: asString(row.name),
    pipeline: row.pipeline,
    position: Number(row.position || 0),
    probability: Number(row.probability || 0),
    isTerminal: Boolean(row.is_terminal),
    isActive: Boolean(row.is_active),
  };
}

function mapCRMAccount(row: any): CRMAccount {
  return {
    id: asString(row.id),
    legacyEmpresaId: row.legacy_empresa_id === null ? null : Number(row.legacy_empresa_id),
    googlePlaceId: row.google_place_id || null,
    ownerId: row.owner_id || null,
    createdBy: row.created_by || null,
    stageId: asString(row.stage_id) || "capturado",
    displayName: asString(row.display_name) || "Sin nombre",
    municipality: asString(row.municipality),
    address: asString(row.address),
    phone: asString(row.phone),
    website: asString(row.website),
    source: asString(row.source),
    priority: row.priority,
    enrichmentStatus: row.enrichment_status,
    dataConfidence: row.data_confidence === null ? null : Number(row.data_confidence),
    nextActionAt: row.next_action_at || null,
    lastContactedAt: row.last_contacted_at || null,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function mapCRMTask(row: any): CRMTask {
  return {
    id: asString(row.id),
    accountId: asString(row.account_id),
    assignedTo: row.assigned_to || null,
    createdBy: asString(row.created_by),
    title: asString(row.title),
    description: asString(row.description),
    priority: row.priority,
    status: row.status,
    dueAt: row.due_at || null,
    completedAt: row.completed_at || null,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function mapCRMActivity(row: any): CRMActivity {
  return {
    id: asString(row.id),
    accountId: asString(row.account_id),
    createdBy: asString(row.created_by),
    activityType: row.activity_type,
    subject: asString(row.subject),
    body: asString(row.body),
    occurredAt: asString(row.occurred_at),
    createdAt: asString(row.created_at),
  };
}

function mapCRMContact(row: any): CRMContact {
  return {
    id: asString(row.id),
    accountId: asString(row.account_id),
    createdBy: asString(row.created_by),
    fullName: asString(row.full_name),
    jobTitle: asString(row.job_title),
    phone: asString(row.phone),
    email: asString(row.email),
    isPrimary: Boolean(row.is_primary),
    isActive: Boolean(row.is_active),
    consentStatus: row.consent_status,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function mapCRMStageHistory(row: any): CRMStageHistory {
  return {
    id: asString(row.id),
    accountId: asString(row.account_id),
    changedBy: asString(row.changed_by),
    fromStageId: row.from_stage_id || null,
    toStageId: asString(row.to_stage_id),
    reason: asString(row.reason),
    createdAt: asString(row.created_at),
  };
}

function legacyNumericId(id: string): number | null {
  return /^\d+$/.test(id) ? Number(id) : null;
}

export function initSupabase(url: string, key: string) {
  if (url && url !== "" && key && key !== "") {
    try {
      supabaseClient = createClient(url, key, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      });
      console.log("Supabase inicializado correctamente.");
    } catch (err) {
      console.error("Error al inicializar Supabase.", err);
    }
  } else {
    console.error("Credenciales de Supabase no configuradas.");
  }
  return { client: supabaseClient, isDemo: false };
}

export function isDemoActive(): boolean {
  return false;
}

export function getSupabaseInstance() {
  return supabaseClient;
}

// =========================================================================
// AUTH & DATABASE SERVICE API
// =========================================================================
export const authService = {
  async signIn(email: string, password: string): Promise<{ user: UserProfile | null; error: string | null }> {
    if (!supabaseClient) {
      return { user: null, error: "Servicio de base de datos no inicializado." };
    }

    // Supabase real login
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    if (error) return { user: null, error: error.message };
    if (!data.user) return { user: null, error: "Error al iniciar sesión." };

    // Fetch user profile and assigned zones
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();
      
    const { data: zonesData } = await supabaseClient
      .from("user_zones")
      .select("municipality")
      .eq("user_id", data.user.id);

    const assignedZones = zonesData ? zonesData.map((z: any) => z.municipality) : [];
    
    const userProfile: UserProfile = {
      id: data.user.id,
      fullName: profileData?.full_name || data.user.user_metadata?.full_name || data.user.email || "Usuario",
      email: data.user.email || email,
      role: profileData?.role || "asesor",
      assignedZones
    };

    return { user: userProfile, error: null };
  },

  async signOut(): Promise<void> {
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }
  },

  async getSession(): Promise<UserProfile | null> {
    if (!supabaseClient) return null;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session || !session.user) return null;

    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    const { data: zonesData } = await supabaseClient
      .from("user_zones")
      .select("municipality")
      .eq("user_id", session.user.id);

    const assignedZones = zonesData ? zonesData.map((z: any) => z.municipality) : [];

    return {
      id: session.user.id,
      fullName: profileData?.full_name || session.user.user_metadata?.full_name || session.user.email || "Usuario",
      email: session.user.email || "",
      role: profileData?.role || "asesor",
      assignedZones
    };
  },

  async getAccessToken(): Promise<string | null> {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) return null;
    return data.session?.access_token || null;
  }
};

export const databaseService = {
  async getAssignedZones(userId: string): Promise<string[]> {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
      .from("user_zones")
      .select("municipality")
      .eq("user_id", userId);
    if (error) {
      console.error("Error al obtener zonas asignadas:", error);
      return [];
    }
    return data.map((d: any) => d.municipality);
  },

  async updateAssignedZones(userId: string, zones: string[]): Promise<void> {
    if (!supabaseClient) return;
    await supabaseClient
      .from("user_zones")
      .delete()
      .eq("user_id", userId);
      
    if (zones.length > 0) {
      const inserts = zones.map(z => ({ user_id: userId, municipality: z }));
      await supabaseClient
        .from("user_zones")
        .insert(inserts);
    }
  },

  async prepareProfessionalCRM(userId: string, leads: ValidatedBusiness[]): Promise<CRMWorkspace> {
    if (!supabaseClient) {
      return { available: false, accounts: [], stages: [], tasks: [] };
    }

    const [stagesResult, contactsResult] = await Promise.all([
      supabaseClient
        .from("crm_pipeline_stages")
        .select("id, name, pipeline, position, probability, is_terminal, is_active")
        .eq("is_active", true)
        .order("position", { ascending: true }),
      supabaseClient
        .from("crm_contacts")
        .select("id", { head: true, count: "exact" })
        .limit(1),
    ]);

    if (isProfessionalCRMUnavailable(stagesResult.error) || isProfessionalCRMUnavailable(contactsResult.error)) {
      return { available: false, accounts: [], stages: [], tasks: [] };
    }
    if (stagesResult.error) throw new Error(`No se pudo cargar el pipeline profesional: ${stagesResult.error.message}`);
    if (contactsResult.error) throw new Error(`No se pudo validar el módulo de contactos: ${contactsResult.error.message}`);

    const { data: currentRows, error: accountsError } = await supabaseClient
      .from("crm_accounts")
      .select("*")
      .order("updated_at", { ascending: false });

    if (isProfessionalCRMUnavailable(accountsError)) {
      return { available: false, accounts: [], stages: [], tasks: [] };
    }
    if (accountsError) throw new Error(`No se pudieron cargar las empresas CRM: ${accountsError.message}`);

    const currentAccounts = (currentRows || []).map(mapCRMAccount);
    const existingLegacyIds = new Set(
      currentAccounts
        .map(account => account.legacyEmpresaId)
        .filter((id): id is number => id !== null)
    );
    const existingPlaceIds = new Set(
      currentAccounts
        .map(account => account.googlePlaceId)
        .filter((id): id is string => Boolean(id))
    );

    const missingAccounts = leads
      .filter(lead => {
        const numericId = legacyNumericId(lead.id);
        return numericId !== null
          ? !existingLegacyIds.has(numericId)
          : !existingPlaceIds.has(lead.id);
      })
      .map(lead => {
        const numericId = legacyNumericId(lead.id);
        const hasAIAnalysis = Boolean(lead.reasoning)
          && !lead.reasoning.toLowerCase().includes("no disponible");

        return {
          legacy_empresa_id: numericId,
          google_place_id: numericId === null ? lead.id : null,
          owner_id: userId,
          created_by: userId,
          stage_id: legacyStatusToCRMStage(lead.crmStatus),
          display_name: lead.name,
          municipality: lead.municipality || null,
          address: lead.address || null,
          phone: lead.phone || null,
          website: lead.website || null,
          source: numericId === null ? "google_places" : "database",
          priority: lead.opportunityScore >= 85 ? "high" : "medium",
          enrichment_status: hasAIAnalysis ? "enriched" : "pending",
          data_confidence: Math.max(0, Math.min(100, Math.round(lead.reliabilityScore * 10))),
        };
      });

    if (missingAccounts.length > 0) {
      const { error: insertError } = await supabaseClient
        .from("crm_accounts")
        .insert(missingAccounts);

      if (insertError && insertError.code !== "23505") {
        throw new Error(`No se pudieron preparar los leads para el CRM profesional: ${insertError.message}`);
      }
    }

    const [{ data: accountRows, error: reloadError }, { data: taskRows, error: tasksError }] = await Promise.all([
      supabaseClient
        .from("crm_accounts")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabaseClient
        .from("crm_tasks")
        .select("*")
        .neq("status", "cancelled")
        .order("due_at", { ascending: true, nullsFirst: false }),
    ]);

    if (reloadError) throw new Error(`No se pudieron actualizar las empresas CRM: ${reloadError.message}`);
    if (tasksError) throw new Error(`No se pudieron cargar las tareas: ${tasksError.message}`);

    return {
      available: true,
      accounts: (accountRows || []).map(mapCRMAccount),
      stages: (stagesResult.data || []).map(mapPipelineStage),
      tasks: (taskRows || []).map(mapCRMTask),
    };
  },

  async getCRMTasks(accountId?: string): Promise<CRMTask[]> {
    if (!supabaseClient) return [];
    let query = supabaseClient
      .from("crm_tasks")
      .select("*")
      .neq("status", "cancelled")
      .order("due_at", { ascending: true, nullsFirst: false });
    if (accountId) query = query.eq("account_id", accountId);
    const { data, error } = await query;
    if (error) throw new Error(`No se pudieron cargar las tareas: ${error.message}`);
    return (data || []).map(mapCRMTask);
  },

  async getCRMActivities(accountId: string): Promise<CRMActivity[]> {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
      .from("crm_activities")
      .select("*")
      .eq("account_id", accountId)
      .order("occurred_at", { ascending: false });
    if (error) throw new Error(`No se pudo cargar la actividad comercial: ${error.message}`);
    return (data || []).map(mapCRMActivity);
  },

  async getCRMStageHistory(accountId: string): Promise<CRMStageHistory[]> {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
      .from("crm_stage_history")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`No se pudo cargar el historial del pipeline: ${error.message}`);
    return (data || []).map(mapCRMStageHistory);
  },

  async getCRMContacts(accountId: string): Promise<CRMContact[]> {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
      .from("crm_contacts")
      .select("*")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error(`No se pudieron cargar los contactos: ${error.message}`);
    return (data || []).map(mapCRMContact);
  },

  async updateCRMAccountStage(accountId: string, stageId: string): Promise<void> {
    if (!supabaseClient) return;
    const { error } = await supabaseClient
      .from("crm_accounts")
      .update({ stage_id: stageId })
      .eq("id", accountId);
    if (error) throw new Error(`No se pudo actualizar la etapa: ${error.message}`);
  },

  async createCRMActivity(input: {
    accountId: string;
    userId: string;
    activityType: CRMActivityType;
    subject?: string;
    body: string;
  }): Promise<CRMActivity> {
    if (!supabaseClient) throw new Error("Servicio de base de datos no inicializado.");
    const { data, error } = await supabaseClient
      .from("crm_activities")
      .insert({
        account_id: input.accountId,
        created_by: input.userId,
        activity_type: input.activityType,
        subject: input.subject || null,
        body: input.body,
      })
      .select("*")
      .single();
    if (error) throw new Error(`No se pudo registrar la actividad: ${error.message}`);
    return mapCRMActivity(data);
  },

  async createCRMTask(input: {
    accountId: string;
    userId: string;
    title: string;
    description?: string;
    priority: CRMPriority;
    dueAt?: string;
  }): Promise<CRMTask> {
    if (!supabaseClient) throw new Error("Servicio de base de datos no inicializado.");
    const { data, error } = await supabaseClient
      .from("crm_tasks")
      .insert({
        account_id: input.accountId,
        assigned_to: input.userId,
        created_by: input.userId,
        title: input.title,
        description: input.description || null,
        priority: input.priority,
        due_at: input.dueAt || null,
      })
      .select("*")
      .single();
    if (error) throw new Error(`No se pudo crear la tarea: ${error.message}`);
    return mapCRMTask(data);
  },

  async updateCRMTaskStatus(taskId: string, status: CRMTaskStatus): Promise<void> {
    if (!supabaseClient) return;
    const { error } = await supabaseClient
      .from("crm_tasks")
      .update({ status })
      .eq("id", taskId);
    if (error) throw new Error(`No se pudo actualizar la tarea: ${error.message}`);
  },

  async createCRMContact(input: {
    accountId: string;
    userId: string;
    fullName: string;
    jobTitle?: string;
    phone?: string;
    email?: string;
    isPrimary?: boolean;
    consentStatus?: CRMConsentStatus;
  }): Promise<CRMContact> {
    if (!supabaseClient) throw new Error("Servicio de base de datos no inicializado.");
    const { data, error } = await supabaseClient
      .from("crm_contacts")
      .insert({
        account_id: input.accountId,
        created_by: input.userId,
        full_name: input.fullName,
        job_title: input.jobTitle || null,
        phone: input.phone || null,
        email: input.email || null,
        is_primary: Boolean(input.isPrimary),
        consent_status: input.consentStatus || "unknown",
      })
      .select("*")
      .single();
    if (error) throw new Error(`No se pudo crear el contacto: ${error.message}`);
    return mapCRMContact(data);
  },

  async getUserLeads(userId: string): Promise<ValidatedBusiness[]> {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
      .from("empresas_formales")
      .select("*")
      .eq("assigned_to", userId)
      .not("crm_status", "is", null);
      
    if (error) {
      console.error("Error al obtener leads de Supabase:", error);
      return [];
    }
    
    return data.map((d: any) => ({
      id: String(d.id),
      name: d.nombre_razon_social || "Sin nombre",
      address: d.direccion || "Sin dirección",
      phone: d.telefonos || "",
      website: d.email || "",
      municipality: d.municipio || "",
      estimatedSize: d.tamano_empresa || "Micro",
      reliabilityScore: d.reliability_score || 0,
      opportunityScore: d.opportunity_score || 0,
      predictedNeed: d.predicted_need || "",
      reasoning: d.reasoning || "",
      isMicroSME: true,
      digitalFootprint: inferDigitalFootprint(d.email, d.telefonos),
      crmStatus: d.crm_status || "nuevo",
      userNotes: d.crm_notes || "",
      businessStatus: "OPERATIONAL",
      types: d.descripcion_ciiu_1 ? [d.descripcion_ciiu_1] : []
    }));
  },

  async getExistingClients(municipality: string, limit = 150): Promise<ValidatedBusiness[]> {
    if (!supabaseClient) return [];
    
    const cleanMun = municipality.split(',')[0].trim().toUpperCase();
    
    const { data, error } = await supabaseClient
      .from('empresas_formales')
      .select('*')
      .eq('municipio', cleanMun)
      .limit(limit);
      
    if (error) {
      console.error("Error al obtener clientes existentes:", error);
      return [];
    }
    
    return (data || []).map((d: any) => ({
      id: String(d.id),
      name: d.nombre_razon_social || "Sin nombre",
      address: d.direccion || "Sin dirección",
      phone: d.telefonos || "",
      website: d.email || "",
      municipality: d.municipio || cleanMun,
      estimatedSize: d.tamano_empresa || "Micro",
      reliabilityScore: d.reliability_score || 0,
      opportunityScore: d.opportunity_score || 0,
      predictedNeed: d.predicted_need || "",
      reasoning: d.reasoning || "",
      isMicroSME: true,
      digitalFootprint: inferDigitalFootprint(d.email, d.telefonos),
      crmStatus: d.crm_status || null,
      userNotes: d.crm_notes || "",
      businessStatus: "OPERATIONAL",
      types: d.descripcion_ciiu_1 ? [d.descripcion_ciiu_1] : [],
      location: d.lat && d.lng ? { lat: Number(d.lat), lng: Number(d.lng) } : undefined,
      isExistingDbClient: true
    }));
  },

  async saveLead(userId: string, lead: ValidatedBusiness): Promise<void> {
    if (!supabaseClient) return;

    const payload = {
      nombre_razon_social: lead.name,
      direccion: lead.address,
      telefonos: lead.phone || null,
      email: lead.website || null,
      municipio: (lead.municipality || '').split(',')[0].trim().toUpperCase(),
      tamano_empresa: lead.estimatedSize || 'Micro',
      lat: lead.location?.lat || null,
      lng: lead.location?.lng || null,
      crm_status: lead.crmStatus || 'nuevo',
      crm_notes: lead.userNotes || '',
      opportunity_score: lead.opportunityScore,
      reliability_score: lead.reliabilityScore,
      predicted_need: lead.predictedNeed,
      reasoning: lead.reasoning || null,
      assigned_to: userId
    };

    const numId = Number(lead.id);
    if (!isNaN(numId)) {
      // It's an existing company with an integer ID, so we update it
      await supabaseClient
        .from('empresas_formales')
        .update(payload)
        .eq('id', numId);
    } else {
      // It's a new prospect from Google, check if name already exists in database
      const { data: existing } = await supabaseClient
        .from('empresas_formales')
        .select('id')
        .eq('nombre_razon_social', lead.name)
        .limit(1);

      if (existing && existing.length > 0) {
        await supabaseClient
          .from('empresas_formales')
          .update(payload)
          .eq('id', existing[0].id);
      } else {
        await supabaseClient
          .from('empresas_formales')
          .insert(payload);
      }
    }
  },

  async saveLeads(userId: string, leads: ValidatedBusiness[]): Promise<void> {
    if (!supabaseClient) return;
    
    for (const lead of leads) {
      try {
        const { data: existing } = await supabaseClient
          .from('empresas_formales')
          .select('id')
          .eq('nombre_razon_social', lead.name)
          .limit(1);

        const payload = {
          nombre_razon_social: lead.name,
          direccion: lead.address,
          telefonos: lead.phone || null,
          email: lead.website || null,
          municipio: (lead.municipality || '').split(',')[0].trim().toUpperCase(),
          tamano_empresa: lead.estimatedSize || 'Micro',
          lat: lead.location?.lat || null,
          lng: lead.location?.lng || null,
          crm_status: lead.crmStatus || 'nuevo',
          crm_notes: lead.userNotes || '',
          opportunity_score: lead.opportunityScore,
          reliability_score: lead.reliabilityScore,
          predicted_need: lead.predictedNeed,
          reasoning: lead.reasoning || null,
          assigned_to: userId
        };

        if (existing && existing.length > 0) {
          await supabaseClient
            .from('empresas_formales')
            .update(payload)
            .eq('id', existing[0].id);
        } else {
          await supabaseClient
            .from('empresas_formales')
            .insert(payload);
        }
      } catch (err) {
        console.error("Error al guardar lote de prospecto:", lead.name, err);
      }
    }
  },

  async updateLeadStatus(userId: string, leadId: string, status: string, notes?: string): Promise<void> {
    if (!supabaseClient) return;
    const payload: any = { crm_status: status };
    if (notes !== undefined) {
      payload.crm_notes = notes;
    }
    
    const numId = Number(leadId);
    if (!isNaN(numId)) {
      await supabaseClient
        .from("empresas_formales")
        .update(payload)
        .eq("assigned_to", userId)
        .eq("id", numId);
    }
  },

  async removeLead(userId: string, leadId: string): Promise<void> {
    if (!supabaseClient) return;
    const numId = Number(leadId);
    if (!isNaN(numId)) {
      await supabaseClient
        .from("empresas_formales")
        .update({
          crm_status: null,
          assigned_to: null
        })
        .eq("assigned_to", userId)
        .eq("id", numId);
    }
  },

  async logActivity(userId: string, email: string, actionType: string, details?: string): Promise<void> {
    if (!supabaseClient) return;
    try {
      await supabaseClient
        .from('activity_logs')
        .insert({
          user_id: userId,
          user_email: email,
          action_type: actionType,
          details: details || null
        });
    } catch (err) {
      console.error("Error logging activity:", err);
    }
  },

  async getActivityLogs(): Promise<any[]> {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error("Error al obtener logs de actividad:", error);
      return [];
    }
    return data || [];
  },

  async getAllLeads(): Promise<any[]> {
    if (!supabaseClient) return [];
    
    const { data, error } = await supabaseClient
      .from('empresas_formales')
      .select('id, nombre_razon_social, municipio, tamano_empresa, opportunity_score, predicted_need, crm_status, assigned_to')
      .not('crm_status', 'is', null);
      
    if (error) {
      console.error("Error al obtener todos los leads para admin:", error);
      return [];
    }
    
    const { data: profiles } = await supabaseClient
      .from('profiles')
      .select('id, full_name');
      
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
    
    return (data || []).map((d: any) => ({
      id: String(d.id),
      name: d.nombre_razon_social,
      municipality: d.municipio,
      estimatedSize: d.tamano_empresa,
      opportunityScore: d.opportunity_score,
      predictedNeed: d.predicted_need,
      crmStatus: d.crm_status,
      assignedTo: d.assigned_to,
      assignedName: profileMap.get(d.assigned_to) || "No asignado"
    }));
  },

  async getAdvisorsMetrics(): Promise<any[]> {
    if (!supabaseClient) return [];
    
    // Get profiles with role 'asesor'
    const { data: profiles, error: pError } = await supabaseClient
      .from('profiles')
      .select('id, full_name, role')
      .eq('role', 'asesor');
      
    if (pError) {
      console.error("Error al obtener asesores para métricas:", pError);
      return [];
    }
    
    const metrics: any[] = [];
    for (const p of profiles || []) {
      // Get user zones
      const { data: zones } = await supabaseClient
        .from('user_zones')
        .select('municipality')
        .eq('user_id', p.id);
        
      const assigned = zones ? zones.map((z: any) => z.municipality) : [];
      
      // Get leads count
      const { count: leadsCount } = await supabaseClient
        .from('empresas_formales')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', p.id)
        .not('crm_status', 'is', null);
        
      // Get activity count
      const { data: logs } = await supabaseClient
        .from('activity_logs')
        .select('action_type')
        .eq('user_id', p.id);
        
      const searchesCount = logs ? logs.filter((l: any) => l.action_type === 'SEARCH').length : 0;
      const downloadsCount = logs ? logs.filter((l: any) => l.action_type === 'DOWNLOAD_EXCEL').length : 0;
      
      metrics.push({
        id: p.id,
        fullName: p.full_name,
        email: p.full_name,
        assignedZones: assigned,
        leadsCount: leadsCount || 0,
        searchesCount,
        downloadsCount
      });
    }
    return metrics;
  }
};
