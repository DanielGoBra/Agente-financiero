import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { 
  Search, Loader2, Download, AlertCircle, FileSpreadsheet, 
  Map as MapIcon, Database, Activity, MapPin, BookmarkPlus, Layers, Phone,
  LogOut, CheckSquare, X, ShieldAlert
} from "lucide-react";
import { ExtractedBusiness, ValidatedBusiness, UserProfile } from "../types";
import { exportToExcel } from "../lib/exportUtils";
import { cn } from "../lib/utils";
import { MapVisualizer } from "./MapVisualizer";
import { ProfessionalCRM } from "./ProfessionalCRM";
import { Dashboard } from "./Dashboard";
import AdminPanel from "./AdminPanel";
import { authService, databaseService, isDemoActive } from "../lib/supabase";

// Predefined ZONES for Antioquia Sur (quick shortcuts)
const PRESETS = [
  { id: "Sabaneta", name: "Sabaneta, Antioquia", subZonas: [
    "Los Arias", "Maria Auxiliadora", "Villas del Carmen", "La Florida", "Los Alcázares",
    "La Barquereña", "San Joaquín", "Betania", "Vegas de la Doctora", "Tres Esquinas",
    "Prados de Sabaneta", "Nuestra Señora de Los Dolores", "Sabaneta Real", "Calle Larga",
    "Holanda", "Entreamigos", "Calle del Banco", "Santa Ana", "Aliadas del Sur",
    "Paso Ancho", "Restrepo Naranjo", "Manuel Restrepo", "Virgen del Carmen", "Las Casitas",
    "San Rafael", "Promisión", "Playas de Maria", "El Carmelo II", "Ancón Sur", "Centro", "Aves María"
  ]},
  { id: "Itagüí", name: "Itagüí, Antioquia", subZonas: [
    "Zona Industrial 1", "Zona Industrial 2", "La Independencia", "San Juan Bautista", "San José",
    "Araucaria", "La Gloria", "Las Mercedes", "Centro", "Asturias", "Los Naranjos", "Villa Paula",
    "Artex", "Playa Rica", "Satexco", "San Isidro", "La Santa Cruz", "Santa Catalina",
    "Samaria", "La Finca", "Yarumito", "El Palmar", "Santa Ana", "Las Margaritas", "Malta",
    "Glorieta Pilsen", "Monte Verde", "Camparola", "San Pio X", "La Palama",
    "Jardines Montesacro", "Zona Industrial 3", "Las Brisas", "Pilsen", "San Javier",
    "Villa Lia", "19 de Abril", "San Gabriel", "San Antonio", "Triana", "Ditaires",
    "San Francisco", "Santa Maria 1", "Santa Maria 2", "Santa Maria 3",
    "Colinas del Sur", "Central Mayorista", "San Fernando", "La Raya", "Simón Bolívar",
    "Las Acacias", "Las Américas", "El Tablazo", "Calatrava", "Loma Linda", "Terranova",
    "La Aldea", "Ferrara", "Balcones de Sevilla", "Fátima", "El Rosario", "La Unión",
    "Santa Maria la Nueva", "Los Olivares", "El Pedregal", "El Progreso", "El Ajizal", "El Porvenir"
  ]},
  { id: "Envigado", name: "Envigado, Antioquia", subZonas: [
    "Las Vegas", "El Portal", "San Marcos", "Pontevedra", "Jardines", "Villagrande",
    "Bosques de Zúñiga", "Los Naranjos", "Mesa", "Zona Centro", "Obrero", "Bucarest",
    "La Magnolia", "La Sebastiana", "Las Flores", "Uribe Ángel", "Alto de Misael",
    "Las Orquídeas", "El Chinguí", "El Salado", "La Mina", "San Rafael", "San José",
    "Las Antillas", "El Trianón", "Loma del Barro", "La Paz", "El Dorado", "Las Casitas",
    "Primavera", "Milán", "Vallejuelos", "Alcalá", "Loma de Las Brujas", "La Pradera",
    "El Chocho", "Inmaculada", "El Escobero", "Santa Catalina", "El Vallano",
    "Las Palmas", "Pantanillo"
  ]},
  { id: "San Antonio de Prado", name: "San Antonio de Prado, Medellín, Antioquia", subZonas: ["Parque Principal", "Barichara", "Limonar", "Pradito", "Centro", "El Vergel", "Naranjitos", "La Capilla"] },
  { id: "Caldas", name: "Caldas, Antioquia", subZonas: ["Centro", "La Inmaculada", "Mandalay", "La Locería", "Andalucía", "Zona Industrial", "Felipe", "Olaya"] },
  { id: "La Estrella", name: "La Estrella, Antioquia", subZonas: ["Parque Principal", "La Aldea", "Pueblo Viejo", "La Tablaza", "Centro", "Zona Industrial", "San Agustín"] }
];

// Rich Category Taxonomy
const SECTOR_CATEGORIES = [
  {
    id: "comercio",
    name: "Comercio Minorista",
    terms: ["Tiendas de barrio", "Papelerías", "Mini-mercados", "Fruver", "Carnicerías", "Droguerías", "Zapaterías", "Boutique de ropa"]
  },
  {
    id: "gastronomia",
    name: "Gastronomía y Alimentos",
    terms: ["Restaurantes", "Panaderías", "Pizzerías", "Cafeterías", "Heladerías", "Comidas rápidas"]
  },
  {
    id: "servicios",
    name: "Servicios y Estética",
    terms: ["Peluquerías", "Barberías", "Spa y Estética", "Lavanderías", "Centros odontológicos", "Veterinarias"]
  },
  {
    id: "industrial_construccion",
    name: "Construcción y Taller",
    terms: ["Ferreterías", "Talleres de motos", "Talleres de autos", "Carpinterías", "Cerrajerías", "Vidrierías"]
  },
  {
    id: "educacion_deporte",
    name: "Educación y Deporte",
    terms: ["Papelerías e Internet", "Salas de videojuegos", "Servicio técnico celular", "Gimnasios"]
  }
];

interface MapAgentProps {
  currentUser: UserProfile;
  onLogout: () => void;
  onUserUpdate: (user: UserProfile) => void;
}

interface BusinessValidation {
  id: string;
  isMicroSME: boolean;
  reliabilityScore: number;
  reasoning: string;
  opportunityScore: number;
  estimatedSize: "micro" | "small" | "medium";
  predictedNeed: string;
  digitalFootprint: "low" | "medium" | "high";
}

interface DurableProspectingCandidate {
  id: string;
  status: string;
  validation: BusinessValidation | null;
}

interface DurableProspectingStatus {
  runId: string;
  status: string;
  workflowStatus: string;
  total: number;
  enriched: number;
  failed: number;
  completedBatches: number;
  totalBatches: number;
  candidates: DurableProspectingCandidate[];
}

function getApiError(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const error = (value as Record<string, unknown>).error;
  return typeof error === "string" ? error : null;
}

function getValidations(value: unknown): BusinessValidation[] | null {
  if (typeof value !== "object" || value === null) return null;
  const validations = (value as Record<string, unknown>).validations;
  return Array.isArray(validations) ? validations as BusinessValidation[] : null;
}

function getDurableProspectingStatus(value: unknown): DurableProspectingStatus | null {
  if (typeof value !== "object" || value === null) return null;
  const status = value as Record<string, unknown>;
  if (typeof status.runId !== "string" || typeof status.status !== "string" || !Array.isArray(status.candidates)) return null;
  const candidates: DurableProspectingCandidate[] = [];
  for (const rawCandidate of status.candidates) {
    if (typeof rawCandidate !== "object" || rawCandidate === null) continue;
    const candidate = rawCandidate as Record<string, unknown>;
    if (typeof candidate.id !== "string" || typeof candidate.status !== "string") continue;
    const validation = candidate.validation
      ? getValidations({ validations: [candidate.validation] })?.[0] || null
      : null;
    candidates.push({ id: candidate.id, status: candidate.status, validation });
  }
  return {
    runId: status.runId,
    status: status.status,
    workflowStatus: typeof status.workflowStatus === "string" ? status.workflowStatus : "unknown",
    total: Number(status.total || 0),
    enriched: Number(status.enriched || 0),
    failed: Number(status.failed || 0),
    completedBatches: Number(status.completedBatches || 0),
    totalBatches: Number(status.totalBatches || 0),
    candidates,
  };
}

export function MapAgent({ currentUser, onLogout, onUserUpdate }: MapAgentProps) {
  const placesLib = useMapsLibrary("places");
  
  // Navigation
  const [activeTab, setActiveTab] = useState<"search" | "crm" | "dashboard" | "admin">("search");

  // Filter presets based on user's assigned zones, and dynamically add missing ones (like Medellin neighborhoods)
  const userPresets = React.useMemo(() => {
    if (!currentUser.assignedZones || currentUser.assignedZones.length === 0) {
      return PRESETS;
    }
    
    const matched = PRESETS.filter(preset => 
      currentUser.assignedZones.some(az => 
        preset.id.toLowerCase().trim() === az.toLowerCase().trim()
      )
    );
    
    const unmatched = currentUser.assignedZones.filter(az => 
      !PRESETS.some(preset => preset.id.toLowerCase().trim() === az.toLowerCase().trim())
    );
    
    const dynamic = unmatched.map(az => ({
      id: az,
      name: az.toLowerCase().includes("medellín") || az.toLowerCase().includes("medellin") 
        ? az 
        : `${az}, Medellín, Antioquia`,
      subZonas: ["Centro", "Zona Comercial", "Parque Principal"]
    }));
    
    return [...matched, ...dynamic];
  }, [currentUser.assignedZones]);
  
  // Search parameters
  const [usePreset, setUsePreset] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState(
    userPresets.length > 0 ? userPresets[0].name : PRESETS[0].name
  );
  // Barrio selector: search one specific neighborhood
  const currentPresetZone = userPresets.find(z => z.name === selectedPreset) || PRESETS.find(z => z.name === selectedPreset);
  const availableBarrios = currentPresetZone?.subZonas || [];
  const [selectedBarrio, setSelectedBarrio] = useState(availableBarrios[0] || "");
  
  // Sync barrio when municipio changes
  useEffect(() => {
    const zone = userPresets.find(z => z.name === selectedPreset) || PRESETS.find(z => z.name === selectedPreset);
    if (zone && zone.subZonas.length > 0) {
      setSelectedBarrio(zone.subZonas[0]);
    }
  }, [selectedPreset]);
  // Portfolio clients loaded from DB
  const [dbClients, setDbClients] = useState<ValidatedBusiness[]>([]);

  useEffect(() => {
    if (selectedPreset) {
      databaseService.getExistingClients(selectedPreset).then(clients => {
        setDbClients(clients);
      });
    }
  }, [selectedPreset]);  // Sync preset if assigned zones change
  useEffect(() => {
    if (userPresets.length > 0) {
      setSelectedPreset(userPresets[0].name);
    }
  }, [currentUser.assignedZones]);
  const [customLocation, setCustomLocation] = useState("");
  
  const [selectedSector, setSelectedSector] = useState(SECTOR_CATEGORIES[0].id);
  const [selectedTerm, setSelectedTerm] = useState(SECTOR_CATEGORIES[0].terms[0]);
  const [customTerm, setCustomTerm] = useState("");
  const [isCustomKeyword, setIsCustomKeyword] = useState(false);

  // Business State
  const [isExtracting, setIsExtracting] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [results, setResults] = useState<ValidatedBusiness[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<ValidatedBusiness | null>(null);
  const [error, setError] = useState("");

  // CRM state (loaded dynamically from database/mock)
  const [crmLeads, setCrmLeads] = useState<ValidatedBusiness[]>([]);

  // Load CRM leads on mount
  useEffect(() => {
    databaseService.getUserLeads(currentUser.id).then(leads => {
      setCrmLeads(leads);
    });
  }, [currentUser.id]);

  // Sync sub-categories when sector category changes
  useEffect(() => {
    const sector = SECTOR_CATEGORIES.find(s => s.id === selectedSector);
    if (sector && sector.terms.length > 0) {
      setSelectedTerm(sector.terms[0]);
    }
  }, [selectedSector]);

  // Lead CRM handlers
  const handleSaveLead = async (biz: ValidatedBusiness) => {
    if (crmLeads.some(l => l.id === biz.id)) return;
    const newLead: ValidatedBusiness = {
      ...biz,
      crmStatus: "nuevo",
      userNotes: "",
      updatedAt: new Date().toISOString()
    };
    await databaseService.saveLead(currentUser.id, newLead);
    setCrmLeads([...crmLeads, newLead]);
  };

  const handleUpdateLead = async (updatedBiz: ValidatedBusiness) => {
    await databaseService.updateLeadStatus(
      currentUser.id, 
      updatedBiz.id, 
      updatedBiz.crmStatus || "nuevo", 
      updatedBiz.userNotes
    );
    const updated = crmLeads.map(l => l.id === updatedBiz.id ? updatedBiz : l);
    setCrmLeads(updated);
  };

  const handleRemoveLead = async (id: string) => {
    await databaseService.removeLead(currentUser.id, id);
    const updated = crmLeads.filter(l => l.id !== id);
    setCrmLeads(updated);
  };

  const getMergedMapBusinesses = () => {
    const merged = [...dbClients];
    const seenNames = new Set(dbClients.map(c => c.name.toLowerCase().trim()));
    const seenAddresses = new Set(dbClients.map(c => c.address.toLowerCase().trim()));
    
    for (const res of results) {
      const nameKey = res.name.toLowerCase().trim();
      const addrKey = res.address.toLowerCase().trim();
      if (!seenNames.has(nameKey) && !seenAddresses.has(addrKey)) {
        merged.push(res);
      }
    }
    return merged;
  };

  const isSaved = (id: string) => {
    const isSavedInCRM = crmLeads.some(l => l.id === id);
    if (isSavedInCRM) return true;
    
    const biz = results.find(r => r.id === id);
    if (biz) {
      const nameKey = biz.name.toLowerCase().trim();
      const addrKey = biz.address.toLowerCase().trim();
      return dbClients.some(c => 
        (c.name.toLowerCase().trim() === nameKey || c.address.toLowerCase().trim() === addrKey) && 
        Boolean(c.crmStatus)
      );
    }
    return false;
  };

  const isExistingDb = (biz: ValidatedBusiness) => {
    const nameKey = biz.name.toLowerCase().trim();
    const addrKey = biz.address.toLowerCase().trim();
    return dbClients.some(c => 
      c.name.toLowerCase().trim() === nameKey || c.address.toLowerCase().trim() === addrKey
    );
  };

  // Google Places Search Scraper Logic
  const handleStartExtraction = async () => {
    if (!placesLib) {
      setError("La librería de Google Places no está lista. Intenta nuevamente.");
      return;
    }
    
    setIsExtracting(true);
    setError("");
    setResults([]);
    setSelectedBiz(null);

    // Fetch existing portfolio clients from database for this search zone
    const searchedZone = usePreset ? selectedPreset : customLocation;
    if (searchedZone) {
      databaseService.getExistingClients(searchedZone).then(clients => {
        setDbClients(clients);
      });
    }

    try {
      const activeKeyword = isCustomKeyword ? customTerm : selectedTerm;
      if (!activeKeyword) {
        throw new Error("Por favor ingresa un término de búsqueda o palabra clave.");
      }

      let locationQuery = "";
      let subQueries: string[] = [];

      if (usePreset) {
        const presetZone = PRESETS.find(z => z.name === selectedPreset);
        if (presetZone) {
          locationQuery = presetZone.name;
          const municipio = presetZone.name.split(",")[0];
          // Search only in the selected barrio
          subQueries = [
            `${activeKeyword} en ${selectedBarrio}, ${municipio}`,
            `${activeKeyword} cerca de ${selectedBarrio}, ${municipio}`,
            `${activeKeyword} barrio ${selectedBarrio}, ${municipio}, Antioquia`
          ];
        } else {
          locationQuery = selectedPreset;
          subQueries = [`${activeKeyword} en ${selectedPreset}`];
        }
      } else {
        if (!customLocation) {
          throw new Error("Por favor ingresa un municipio o ciudad para realizar la búsqueda.");
        }
        locationQuery = customLocation;
        const cityOnly = customLocation.split(",")[0];
        subQueries = [
          `${activeKeyword} en ${customLocation}`,
          `${activeKeyword} en centro, ${cityOnly}`,
          `${activeKeyword} en zona comercial, ${cityOnly}`,
          `${activeKeyword} en parque principal, ${cityOnly}`,
          `${activeKeyword} en zona rosa, ${cityOnly}`,
          `${activeKeyword} en norte, ${cityOnly}`,
          `${activeKeyword} en sur, ${cityOnly}`,
          `${activeKeyword} en avenida principal, ${cityOnly}`,
          `${activeKeyword} en oriente, ${cityOnly}`,
          `${activeKeyword} en occidente, ${cityOnly}`
        ];
      }

      let allExtracted: ExtractedBusiness[] = [];
      const seenIds = new Set<string>();
      const seenNameAddr = new Set<string>();

      for (let qi = 0; qi < subQueries.length; qi++) {
        const query = subQueries[qi];
        const barrio = query.split(" en ")[1] || query;
        setStatusText(`🔍 Barrio ${qi + 1}/${subQueries.length}: "${barrio}" — ${allExtracted.length} negocios únicos encontrados`);
        
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
              'types',
              'location'
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
              municipality: locationQuery.split(",")[0],
              website: p.websiteURI || "",
              rating: p.rating || 0,
              userRatingsTotal: p.userRatingCount || 0,
              businessStatus: p.businessStatus || "OPERATIONAL",
              types: p.types || [],
              location: p.location ? { lat: p.location.lat(), lng: p.location.lng() } : undefined
            }));

            for (const b of extracted) {
              const nameAddrKey = `${b.name.toLowerCase().trim()}|${b.address.toLowerCase().trim()}`;
              if (!seenIds.has(b.id) && !seenNameAddr.has(nameAddrKey)) {
                seenIds.add(b.id);
                seenNameAddr.add(nameAddrKey);
                allExtracted.push(b);
              }
            }
          }
        } catch (e) {
          console.error("Error executing sub-query:", query, e);
        }

        // Small delay between requests to avoid rate limiting on Places API
        if (qi < subQueries.length - 1) {
          await new Promise(r => setTimeout(r, 200));
        }
      }

      if (allExtracted.length === 0) {
        setStatusText("No se encontraron resultados en esta zona para los criterios.");
        setIsExtracting(false);
        return;
      }

      setStatusText(`Se obtuvieron ${allExtracted.length} negocios. Analizando con IA (filtrando grandes cadenas y perfilando)...`);

      const fetchWithRetry = async (url: string, options: RequestInit, retries = 2, delay = 3000): Promise<Response> => {
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            const res = await fetch(url, options);
            if (res.ok) return res;
            console.warn(`Intento ${attempt}/${retries} falló con código ${res.status}.`);

            if (res.status === 429 && attempt < retries) {
              const retryAfter = Number(res.headers.get("Retry-After"));
              if (Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 60) {
                setStatusText(`El servicio de IA alcanzó su límite temporal. Reintentando en ${retryAfter} segundos...`);
                await new Promise(r => setTimeout(r, retryAfter * 1000));
                continue;
              }
            }

            if ([400, 401, 402, 403, 413, 429].includes(res.status)) return res;
            if (attempt === retries) return res;
          } catch (err) {
            console.error(`Intento ${attempt}/${retries} falló por error de red:`, err);
            if (attempt === retries) throw err;
          }
          setStatusText(`El servidor de IA está ocupado. Reintentando de forma automática (intento ${attempt + 1}/${retries})...`);
          await new Promise(r => setTimeout(r, delay));
        }
        throw new Error("No se pudo completar el análisis tras varios reintentos automáticos.");
      };

      let validations: BusinessValidation[] = [];
      // This is a per-request size, not a total-results limit. Smaller outputs
      // avoid truncated JSON while the loop continues through every prospect.
      const chunkSize = 20;
      const delayBetweenBatchesMs = 3250;
      const accessToken = await authService.getAccessToken();
      if (!accessToken) {
        throw new Error("Tu sesión expiró. Inicia sesión nuevamente para continuar.");
      }

      const activeZone = usePreset ? selectedPreset : customLocation;

      const validateSequentially = async (businesses: ExtractedBusiness[]): Promise<BusinessValidation[]> => {
        const fallbackValidations: BusinessValidation[] = [];
        for (let i = 0; i < businesses.length; i += chunkSize) {
          const chunk = businesses.slice(i, i + chunkSize);
          const currentBatch = Math.floor(i / chunkSize) + 1;
          const totalBatches = Math.ceil(businesses.length / chunkSize);
          setStatusText(`Analizando lote alterno ${currentBatch} de ${totalBatches}...`);

          const valRes = await fetchWithRetry("/api/validate-businesses", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ businesses: chunk }),
          });

          if (!valRes.ok) {
            const errText = await valRes.text();
            let errorMessage: string | null = null;
            try { errorMessage = getApiError(JSON.parse(errText) as unknown); } catch {}
            if (![402, 429, 500, 502, 503, 504].includes(valRes.status)) {
              throw new Error(errorMessage || `Fallo en el servidor de IA (Código: ${valRes.status}). Reintenta.`);
            }
            console.warn(errorMessage || `Lote alterno ${currentBatch} sin enriquecimiento (${valRes.status}).`);
          } else {
            const batchValidations = getValidations(await valRes.json() as unknown);
            if (batchValidations) fallbackValidations.push(...batchValidations);
          }

          if (i + chunkSize < businesses.length) await new Promise(resolve => setTimeout(resolve, delayBetweenBatchesMs));
        }
        return fallbackValidations;
      };

      let durableRunStarted = false;
      try {
        setStatusText(`Creando análisis durable para ${allExtracted.length} prospectos...`);
        const startResponse = await fetch("/api/prospecting/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ businesses: allExtracted, territory: activeZone, sector: activeKeyword }),
        });

        if (!startResponse.ok) {
          const startError = await startResponse.json().catch(() => null) as unknown;
          throw new Error(getApiError(startError) || `No se pudo iniciar el Workflow (${startResponse.status}).`);
        }

        const startPayload = await startResponse.json() as { runId?: unknown };
        if (typeof startPayload.runId !== "string") throw new Error("El Workflow no devolvió un identificador válido.");
        durableRunStarted = true;
        localStorage.setItem(`crm-prospecting-run:${currentUser.id}`, startPayload.runId);

        for (let poll = 0; poll < 360; poll += 1) {
          const progressResponse = await fetch(`/api/prospecting/${encodeURIComponent(startPayload.runId)}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!progressResponse.ok) throw new Error(`No se pudo consultar el progreso (${progressResponse.status}).`);
          const progress = getDurableProspectingStatus(await progressResponse.json() as unknown);
          if (!progress) throw new Error("El Workflow devolvió un estado inválido.");

          setStatusText(
            `Análisis durable: ${progress.enriched + progress.failed} de ${progress.total} procesados` +
            (progress.totalBatches ? ` · lote ${Math.min(progress.completedBatches + 1, progress.totalBatches)} de ${progress.totalBatches}` : "")
          );

          if (["completed", "partial", "failed"].includes(progress.status)) {
            validations = progress.candidates
              .map(candidate => candidate.validation)
              .filter((validation): validation is BusinessValidation => validation !== null);
            localStorage.removeItem(`crm-prospecting-run:${currentUser.id}`);
            break;
          }

          if (["errored", "terminated"].includes(progress.workflowStatus)) {
            throw new Error("El Workflow durable terminó antes de completar todos los lotes.");
          }

          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (durableError) {
        console.warn("Workflow durable no disponible; se activa el flujo compatible.", durableError);
      }

      const validatedIds = new Set(validations.map(validation => validation.id));
      const unresolvedBusinesses = allExtracted.filter(business => !validatedIds.has(business.id));
      if (!durableRunStarted || unresolvedBusinesses.length > 0) {
        if (durableRunStarted && unresolvedBusinesses.length > 0) {
          setStatusText(`Recuperando ${unresolvedBusinesses.length} prospectos pendientes por el flujo alterno...`);
        }
        validations.push(...await validateSequentially(unresolvedBusinesses));
      }

      setStatusText("Finalizando perfilamiento...");
      
      const mergedResults: ValidatedBusiness[] = allExtracted.map(ext => {
        const aiAnalysis = validations.find((validation) => validation.id === ext.id);
        return {
          ...ext,
          isMicroSME: aiAnalysis ? aiAnalysis.isMicroSME : true,
          reliabilityScore: aiAnalysis ? aiAnalysis.reliabilityScore : 5,
          reasoning: aiAnalysis ? aiAnalysis.reasoning : "Análisis no disponible",
          opportunityScore: aiAnalysis ? aiAnalysis.opportunityScore : 50,
          estimatedSize: aiAnalysis ? aiAnalysis.estimatedSize : "micro",
          predictedNeed: aiAnalysis ? aiAnalysis.predictedNeed : "Capital de trabajo",
          digitalFootprint: aiAnalysis ? aiAnalysis.digitalFootprint : "low"
        };
      });

      const finalResults = mergedResults
        .filter(b => b.isMicroSME)
        .sort((a, b) => b.opportunityScore - a.opportunityScore);

      const enrichedIds = new Set(validations.map(validation => validation.id));
      const withoutAiEnrichment = allExtracted.filter(business => !enrichedIds.has(business.id)).length;

      setResults(finalResults);
      
      try {
        setStatusText(`Rastreo finalizado: ${finalResults.length} pymes perfiladas. Guardando en base de datos...`);
        await databaseService.saveLeads(currentUser.id, finalResults);
        setStatusText(
          withoutAiEnrichment > 0
            ? `Rastreo finalizado: ${finalResults.length} prospectos guardados; ${withoutAiEnrichment} quedaron con perfil base por límite temporal de IA.`
            : `Rastreo finalizado: ${finalResults.length} pymes perfiladas y guardadas automáticamente.`
        );
        
        await databaseService.logActivity(
          currentUser.id, 
          currentUser.email, 
          "SEARCH", 
          `Búsqueda en ${activeZone} - Sector: "${activeKeyword}". Encontradas: ${finalResults.length} pymes.`
        );
      } catch (saveErr) {
        console.error("Error al guardar prospectos automáticamente:", saveErr);
        setStatusText(`Rastreo finalizado: ${finalResults.length} pymes perfiladas.`);
      }
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocurrió un error inesperado.");
      setStatusText("");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleExportExcel = async () => {
    const filename = `negocios_${(usePreset ? selectedPreset : customLocation).split(",")[0]}_${(isCustomKeyword ? customTerm : selectedTerm).replace(/\s+/g, "_")}.xlsx`;
    exportToExcel(results, filename);
    await databaseService.logActivity(
      currentUser.id, 
      currentUser.email, 
      "DOWNLOAD_EXCEL", 
      `Exportó ${results.length} prospectos en archivo "${filename}"`
    );
  };

  return (
    <div className="w-full h-full workspace-shell text-slate-800 font-body overflow-hidden flex flex-col">
      
      {/* Premium Header */}
      <header className="px-4 md:px-6 xl:px-8 py-4 border-b border-slate-200/70 flex flex-col xl:flex-row justify-between items-start xl:items-center glass sticky top-0 z-40 gap-3 shadow-xs">
        <div className="flex items-center gap-3.5">
          <img src="/logo-pymes.svg" alt="Localizador PYMEs" className="w-10 h-10 drop-shadow-md" />
          <div>
            <p className="uppercase tracking-[0.2em] text-[9px] font-bold mb-0.5 text-ink-700 font-body">
              Plataforma de Prospección Comercial
            </p>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">
              Localizador <span className="text-ink-600 font-display italic font-normal">PYMEs</span>
            </h1>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 self-stretch xl:self-auto justify-between md:justify-end min-w-0">
          {/* Navigation Tabs */}
          <nav className="flex border border-slate-200/60 p-1 bg-white/60 backdrop-blur-sm font-body text-xs font-semibold rounded-xl shadow-xs gap-0.5 overflow-x-auto custom-scrollbar max-w-full" aria-label="Navegación principal">
            {[
              { key: "search" as const, icon: <MapIcon size={14} />, label: "Buscador & Mapa" },
              { key: "crm" as const, icon: <Database size={14} />, label: `Pipeline CRM (${crmLeads.length})` },
              { key: "dashboard" as const, icon: <Activity size={14} />, label: "Dashboard" },
              ...((currentUser.role === "superAdmin" || currentUser.role === "admin") ? [{ key: "admin" as const, icon: <ShieldAlert size={14} className="text-ink-600" />, label: "Panel Admin" }] : [])
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-3.5 py-2.5 flex items-center gap-1.5 rounded-lg transition-all duration-200 cursor-pointer relative whitespace-nowrap flex-shrink-0",
                  activeTab === tab.key
                    ? "bg-white text-ink-700 shadow-soft border border-slate-100/80"
                    : "hover:text-slate-800 text-slate-500 hover:bg-white/40"
                )}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.key && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute bottom-0 left-[15%] right-[15%] h-[2.5px] bg-gradient-to-r from-ink-700 to-ink-500 rounded-full"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </nav>

          {/* User Info & Logout */}
          <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-slate-200/60 pt-3 md:pt-0 md:pl-4 w-full md:w-auto justify-end font-body">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-800 leading-none">{currentUser.fullName}</p>
              <p className="text-[9px] text-slate-400 font-semibold mt-1 uppercase tracking-wider">{currentUser.role}</p>
            </div>
            
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-ink-600 to-ink-700 text-white flex items-center justify-center font-bold text-xs shadow-md uppercase select-none ring-2 ring-ink-200/30">
              {currentUser.fullName.substring(0, 2)}
            </div>
            
            <button
              onClick={onLogout}
              className="p-2 border border-slate-200/60 hover:border-rose-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all cursor-pointer shadow-xs ml-1"
              title="Cerrar Sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            className="flex-1 flex min-h-0 overflow-hidden"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
        
        {/* Tab 1: Search & Map */}
        {activeTab === "search" && (
          <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden p-4 md:p-5 xl:p-6 gap-4 xl:gap-6">
            
            {/* Sidebar Controls */}
            <aside className="search-sidebar w-full lg:w-80 xl:w-[340px] p-5 xl:p-6 flex flex-col gap-6 product-panel-raised overflow-y-auto custom-scrollbar flex-shrink-0">
              
              {/* Location Input Section */}
              <section className="space-y-3.5">
                <h3 className="section-kicker border-b border-slate-100 pb-2.5">
                  1. Territorio
                </h3>
                
                <div className="flex gap-4 font-sans text-xs text-slate-600 mb-2">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium hover:text-slate-800">
                    <input 
                      type="radio" 
                      checked={usePreset} 
                      onChange={() => setUsePreset(true)}
                      disabled={isExtracting}
                      className="accent-teal-600" 
                    />
                    Zonas predefinidas
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium hover:text-slate-800">
                    <input 
                      type="radio" 
                      checked={!usePreset} 
                      onChange={() => setUsePreset(false)}
                      disabled={isExtracting}
                      className="accent-teal-600" 
                    />
                    Escribir ciudad
                  </label>
                </div>

                <div className="font-sans">
                  {usePreset ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase">Selecciona municipio</label>
                        <select
                          value={selectedPreset}
                          onChange={(e) => setSelectedPreset(e.target.value)}
                          disabled={isExtracting}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer"
                        >
                          {userPresets.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      
                      {availableBarrios.length > 0 && (
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold uppercase">Selecciona barrio / zona</label>
                          <select
                            value={selectedBarrio}
                            onChange={(e) => setSelectedBarrio(e.target.value)}
                            disabled={isExtracting}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer"
                          >
                            {availableBarrios.map(b => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                          <p className="text-[9px] text-slate-400 italic">{availableBarrios.length} barrios disponibles en este municipio</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase">Nombre del municipio o ciudad</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 text-slate-400" size={14} />
                        <input
                          type="text"
                          placeholder="Ej. Envigado, Antioquia"
                          value={customLocation}
                          onChange={(e) => setCustomLocation(e.target.value)}
                          disabled={isExtracting}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-700 font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Assigned Zones Info Card */}
              <section className="surface-subtle p-4 rounded-2xl space-y-2 shadow-xs font-body">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <CheckSquare size={13} className="text-teal-600" /> Zonas Asignadas a Tu Perfil
                </h4>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {currentUser.assignedZones && currentUser.assignedZones.length > 0 ? (
                    currentUser.assignedZones.map((z) => (
                      <span key={z} className="px-2 py-0.5 rounded-full text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-100 capitalize">
                        {z}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Ninguna zona asignada</span>
                  )}
                </div>
              </section>

              {/* Business Categories Section */}
              <section className="space-y-3.5">
                <h3 className="section-kicker border-b border-slate-100 pb-2.5">
                  2. Sector Comercial
                </h3>
                
                <div className="space-y-3 font-sans">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase">Macrosector económico</label>
                    <select
                      value={selectedSector}
                      onChange={(e) => {
                        setSelectedSector(e.target.value);
                        setIsCustomKeyword(false);
                      }}
                      disabled={isExtracting}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer"
                    >
                      {SECTOR_CATEGORIES.map(sc => (
                        <option key={sc.id} value={sc.id}>{sc.name}</option>
                      ))}
                      <option value="custom">-- Escribir Personalizado --</option>
                    </select>
                  </div>

                  {selectedSector !== "custom" && !isCustomKeyword ? (
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase">Tipo de pyme o negocio</label>
                      <select
                        value={selectedTerm}
                        onChange={(e) => setSelectedTerm(e.target.value)}
                        disabled={isExtracting}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer"
                      >
                        {SECTOR_CATEGORIES.find(s => s.id === selectedSector)?.terms.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase">Palabra clave de búsqueda</label>
                      <input
                        type="text"
                        placeholder="Ej. Distribuidora de huevos"
                        value={customTerm}
                        onChange={(e) => {
                          setCustomTerm(e.target.value);
                          setIsCustomKeyword(true);
                        }}
                        disabled={isExtracting}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 placeholder:text-slate-400"
                      />
                    </div>
                  )}
                </div>
              </section>

              {/* Extraction Trigger */}
              <section className="space-y-3 mt-2">
                <button
                  onClick={handleStartExtraction}
                  disabled={isExtracting}
                  className={cn(
                    "w-full text-xs font-semibold uppercase tracking-wider py-3.5 rounded-xl transition-all cursor-pointer",
                    isExtracting 
                      ? "primary-action"
                      : "primary-action"
                  )}
                >
                  {isExtracting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={13} className="animate-spin text-slate-400" />
                      Rastreando área...
                    </span>
                  ) : "Iniciar Localización"}
                </button>
                
                {statusText && (
                  <div className="bg-teal-50/55 border border-teal-100 p-3 rounded-lg text-slate-600 text-[10px] leading-relaxed flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-ping mt-1 flex-shrink-0" />
                    <span>{statusText}</span>
                  </div>
                )}
                
                {error && (
                  <p className="text-[10px] text-rose-600 leading-normal flex items-center gap-1.5 font-medium bg-rose-50 border border-rose-100 p-2.5 rounded-lg">
                    <AlertCircle size={12} className="text-rose-500" />
                    {error}
                  </p>
                )}
              </section>

              {/* Export Panel */}
              {results.length > 0 && (
                <section className="mt-auto border-t border-slate-100 pt-5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Exportar datos</h4>
                  <button
                    onClick={handleExportExcel}
                    className="w-full secondary-action text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet size={14} className="text-teal-600" />
                    Exportar listado Excel
                  </button>
                </section>
              )}
            </aside>

            {/* Split Main Content Area */}
            <main className="flex-1 flex flex-col xl:flex-row overflow-hidden bg-transparent gap-6">
              
              {/* Left pane: Results Table list */}
              <div className="flex-1 p-5 xl:p-6 overflow-auto product-panel-raised flex flex-col custom-scrollbar min-w-0">
                <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
                  <h2 className="text-xl font-bold text-slate-900">Resultados Identificados</h2>
                  <span className="text-[10px] text-teal-700 bg-teal-50 border border-teal-100 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                    {results.length} PYMEs Validadas
                  </span>
                </div>

                {results.length > 0 ? (
                  <div className="space-y-3">
                    <table className="w-full text-left text-xs border-collapse bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100 data-table">
                      <thead>
                        <tr className="uppercase tracking-wider opacity-60 border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-600">
                          <th className="p-3.5 min-w-[150px]">Negocio</th>
                          <th className="p-3.5 text-center">Score Captación</th>
                          <th className="p-3.5 text-right">Contacto</th>
                          <th className="p-3.5 text-center">CRM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {results.map((biz) => (
                          <tr 
                            key={biz.id} 
                            onClick={() => setSelectedBiz(biz)}
                            className={cn(
                              "hover:bg-slate-50/80 transition-all duration-200 cursor-pointer border-b border-slate-100 last:border-0",
                              selectedBiz?.id === biz.id ? "bg-ink-50/70 shadow-[inset_3px_0_0_#14b8a6]" : ""
                            )}
                          >
                            <td className="p-3.5 align-top">
                              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                                {biz.name}
                                {biz.opportunityScore >= 80 && (
                                  <span className="text-[9px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100 uppercase tracking-wide">
                                    Óptimo
                                  </span>
                                )}
                                {isExistingDb(biz) && (
                                  <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-wide">
                                    Base de Datos
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 capitalize mt-1 font-semibold flex items-center gap-1">
                                <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono text-[9px]">
                                  {biz.estimatedSize === 'micro' ? 'Micropyme' : biz.estimatedSize === 'small' ? 'Pequeña' : 'Mediana'}
                                </span>
                                <span>•</span>
                                <span className="text-teal-700 font-sans">{biz.predictedNeed}</span>
                              </div>
                              <div className="text-[10.5px] text-slate-500 mt-2.5 max-w-[325px] leading-relaxed italic font-serif border-l-2 border-slate-200 pl-2">
                                "{biz.reasoning}"
                              </div>
                            </td>
                            
                            <td className="p-3.5 text-center align-top">
                              <span className={cn(
                                "px-2.5 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1 shadow-sm mt-0.5",
                                biz.opportunityScore >= 80 ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
                                biz.opportunityScore >= 50 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-rose-700 bg-rose-50 border-rose-200"
                              )}>
                                <span className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  biz.opportunityScore >= 80 ? "bg-emerald-500 animate-pulse" :
                                  biz.opportunityScore >= 50 ? "bg-amber-500" : "bg-rose-500"
                                )} />
                                {biz.opportunityScore}%
                              </span>
                            </td>

                            <td className="p-3.5 text-right align-top space-y-1">
                              <div className="font-mono text-slate-500 text-[11px] font-medium flex items-center justify-end gap-1 mt-0.5">
                                <Phone size={11} className="text-slate-300" />
                                {biz.phone || "Sin teléfono"}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[150px] ml-auto flex items-center justify-end gap-1" title={biz.address}>
                                <MapPin size={11} className="text-slate-300 flex-shrink-0" />
                                {biz.address.split(",")[0]}
                              </div>
                            </td>

                            <td className="p-3.5 text-center align-top" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleSaveLead(biz)}
                                disabled={isSaved(biz.id)}
                                className={cn(
                                  "p-2 border rounded-lg transition-all inline-flex items-center justify-center cursor-pointer shadow-sm",
                                  isSaved(biz.id)
                                    ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed shadow-none"
                                    : "bg-white text-slate-600 border-slate-200 hover:border-teal-500 hover:text-teal-600 hover:bg-teal-50/20"
                                )}
                                title={isSaved(biz.id) ? "Guardado en CRM" : "Guardar en CRM"}
                              >
                                <BookmarkPlus size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : !isExtracting && !error ? (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-300 border border-dashed border-ink-200/80 surface-subtle mt-4 p-8 text-center rounded-2xl">
                    <div className="w-12 h-12 rounded-2xl bg-ink-50 border border-ink-100 flex items-center justify-center mb-3">
                      <Search size={22} className="text-ink-600" />
                    </div>
                    <p className="text-slate-800 text-xs font-bold uppercase tracking-wider">Esperando búsqueda</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                      Elige el territorio y sector en la barra lateral e inicia el rastreo para perfilar las pymes de la zona.
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Right pane: Map Visualizer */}
              <div className="w-full xl:w-[420px] p-5 xl:p-6 flex flex-col h-[450px] xl:h-full product-panel-raised flex-shrink-0">
                <h3 className="section-kicker mb-3.5 flex items-center gap-2">
                  <MapIcon size={14} className="text-teal-600" /> Mapeo geográfico
                </h3>
                <div className="flex-1 min-h-[300px] rounded-xl overflow-hidden border border-slate-100">
                  <MapVisualizer 
                    businesses={getMergedMapBusinesses()} 
                    selectedBiz={selectedBiz}
                    onSelectBiz={setSelectedBiz}
                    onSaveLead={handleSaveLead}
                    isSaved={isSaved}
                  />
                </div>
              </div>

            </main>
          </div>
        )}

        {/* Tab 2: Lead CRM */}
        {activeTab === "crm" && (
          <ProfessionalCRM
            currentUser={currentUser}
            leads={crmLeads}
            onUpdateLead={handleUpdateLead}
            onRemoveLead={handleRemoveLead}
          />
        )}

        {/* Tab 3: Dashboard */}
        {activeTab === "dashboard" && (
          <Dashboard leads={crmLeads} />
        )}

        {/* Tab 4: Admin Panel */}
        {activeTab === "admin" && (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
            <AdminPanel />
          </div>
        )}

          </motion.div>
        </AnimatePresence>

      </div>

    </div>
  );
}
