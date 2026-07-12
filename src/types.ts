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
}

export interface ValidatedBusiness extends ExtractedBusiness {
  isMicroSME: boolean;
  reliabilityScore: number;
  reasoning: string;
}
