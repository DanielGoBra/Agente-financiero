import { createClient } from "@supabase/supabase-js";
import { UserProfile, ValidatedBusiness } from "../types";

let supabaseClient: any = null;

export function initSupabase(url: string, key: string) {
  if (url && url !== "" && key && key !== "") {
    try {
      supabaseClient = createClient(url, key);
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
