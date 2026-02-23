// ─── Report Types ─────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'unknown';

export type SyncStatus = 'pending' | 'syncing' | 'uploaded' | 'failed';

export interface GPSCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface MLPrediction {
  species_name: string;
  confidence_score: number;
  invasive_risk_level: RiskLevel;
}

export interface InvasiveReport {
  id: string;
  imageUri: string;
  audioUri?: string;          // optional audio recording
  audioDuration?: number;     // duration in seconds
  coordinates: GPSCoordinates;
  timestamp: string;          // ISO 8601
  notes: string;
  prediction: MLPrediction | null;
  syncStatus: SyncStatus;
  userId: string;
}

// ─── Outbreak Types ───────────────────────────────────────────────────────────

export interface OutbreakZone {
  id: string;
  centerCoordinates: GPSCoordinates;
  radiusKm: number;
  reportCount: number;
  detectedAt: string;
  reports: InvasiveReport[];
}

// ─── Auth Types ───────────────────────────────────────────────────────────────

export type UserRole = 'user' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  token: string;
  phone?: string;
  home_location?: string;
  home_latitude?: number;
  home_longitude?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// ─── API Types ────────────────────────────────────────────────────────────────

export interface PredictResponse {
  species_name: string;
  confidence_score: number;
  invasive_risk_level: RiskLevel;
  top_predictions?: Array<{
    species_name: string;
    confidence: number;
    risk_level: string;
  }>;
}

export interface SyncReportPayload {
  id: string;
  imageUri: string;
  audioUri?: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  notes: string;
  prediction: MLPrediction | PredictResponse | null;
  userId: string;
}

// ─── Dashboard Types ──────────────────────────────────────────────────────────

export interface DashboardStats {
  totalReports: number;
  pendingUploads: number;
  highRiskZones: number;
  speciesDistribution: Record<string, number>;
  recentReports: InvasiveReport[];
}
