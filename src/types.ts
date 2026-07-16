export interface ExtractedBusiness {
  id: string;
  name: string;
  address: string;
  phone: string;
  municipality: string;
  website: string;
  rating?: number;
  userRatingsTotal?: number;
  businessStatus: string;
  types: string[];
  location?: {
    lat: number;
    lng: number;
  };
}


export interface ValidatedBusiness extends ExtractedBusiness {
  isExistingDbClient?: boolean;
  isMicroSME: boolean;
  reliabilityScore: number; // 1-10 reliability
  reasoning: string;
  opportunityScore: number; // 1-100 credit opportunity
  estimatedSize: "micro" | "small" | "medium";
  predictedNeed: string;
  digitalFootprint: "low" | "medium" | "high";
  crmStatus?: "nuevo" | "contactado" | "interesado" | "aprobado" | "descartado";
  userNotes?: string;
  updatedAt?: string;
}
export interface UserProfile {
  id: string;
  fullName: string;
  role: string;
  email: string;
  assignedZones: string[];
}

export interface UserZone {
  id?: number;
  userId: string;
  municipality: string;
}
