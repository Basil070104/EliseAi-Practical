export interface LeadInput {
  name: string;
  email: string;
  company: string;
  address: string;
  city: string;
  state: string;
}

export interface GeoData {
  lat: number;
  lng: number;
  stateFips: string;
  placeFips: string;
}

export interface CensusData {
  totalOccupied: number;
  renterOccupied: number;
  renterRate: number; // 0–1
  population: number;
  medianIncome: number;
}

export interface WalkScoreData {
  walkScore: number;
  walkDescription: string;
  transitScore: number | null;
  transitDescription: string | null;
  bikeScore: number | null;
}

export interface ClaudeOutput {
  score: number;
  rationale: string[];
  email: string;
  insights: string[];
}

export type ScoreTier = "Hot" | "Warm" | "Cold";

export interface EnrichedLead extends LeadInput {
  geo: GeoData | null;
  census: CensusData | null;
  walkScoreData: WalkScoreData | null;
  claude: ClaudeOutput | null;
  scoreTier: ScoreTier | null;
  error: string | null;
}

export interface HistoryEntry {
  id: string;
  sessionId: string;
  timestamp: number;
  label: string; // e.g. "Jane Smith" or "3 leads via CSV"
  leads: EnrichedLead[];
}
