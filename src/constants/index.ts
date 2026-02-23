// --- API -------------------------------------------------------------------
export const API_BASE_URL = 'http://10.164.17.110:8000';
export const API_TIMEOUT_MS = 30_000;

// --- Storage Keys ----------------------------------------------------------
export const STORAGE_KEYS = {
  AUTH_TOKEN: '@invadr_auth_token',
  AUTH_USER: '@invadr_auth_user',
  PENDING_REPORTS: '@invadr_pending_reports',
  SYNCED_REPORTS: '@invadr_synced_reports',
} as const;

// --- Image Optimization ----------------------------------------------------
export const IMAGE_CONFIG = {
  WIDTH: 512,
  HEIGHT: 512,
  COMPRESS: 0.65,
  MAX_BYTES: 300_000,
} as const;

// --- Outbreak Detection ----------------------------------------------------
export const OUTBREAK_CONFIG = {
  MIN_REPORTS: 5,
  RADIUS_KM: 5,
  TIME_WINDOW_DAYS: 7,
  MIN_CONFIDENCE: 0.75,
} as const;

// --- Risk Level Colors -----------------------------------------------------
export const RISK_COLORS: Record<string, string> = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#EF4444',
  unknown: '#9CA3AF',
};

// --- Sync Status -----------------------------------------------------------
export const SYNC_STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  syncing: '#F97316',
  uploaded: '#10B981',
  failed: '#EF4444',
};

export const SYNC_STATUS_LABELS: Record<string, string> = {
  pending: 'QUEUED',
  syncing: 'TRANSMITTING',
  uploaded: 'SENT',
  failed: 'FAILED',
};

// --- App Colors (Light Theme) ----------------------------------------------
export const COLORS = {
  background: '#F2F4F7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E5E9EF',
  borderLight: '#F0F2F5',

  primary: '#2D6A4F',
  primaryDark: '#1B4D3E',
  primaryLight: '#E8F5EE',
  primaryMuted: '#A7D7C5',

  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  warning: '#F59E0B',
  warningLight: '#FFF8E1',
  info: '#3B82F6',
  success: '#10B981',
  successLight: '#ECFDF5',

  text: '#1A202C',
  textSecondary: '#4A5568',
  textMuted: '#6B7280',
  textDim: '#9CA3AF',

  white: '#FFFFFF',
  black: '#000000',

  splash: '#2D5F3F',
  splashDark: '#1A3C28',
  splashLight: '#4A7C5C',
} as const;
