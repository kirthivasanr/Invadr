/**
 * apiService.ts
 * Handles all HTTP communication with the FastAPI backend.
 */
import axios, { AxiosInstance } from 'axios';
import { API_BASE_URL, API_TIMEOUT_MS } from '../constants';
import * as SecureStore from 'expo-secure-store';
import { AuthUser, InvasiveReport, LoginCredentials, PredictResponse, SyncReportPayload } from '../types';

const TOKEN_KEY = 'invadr_token';

interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  phone?: string;
  home_location?: string;
  home_latitude?: number;
  home_longitude?: number;
}

// ─── Axios Instance ────────────────────────────────────────────────────────────

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

// Attach token to every request automatically
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // SecureStore unavailable — continue without token
  }
  return config;
});

// Extract meaningful error messages from backend responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw error;
  },
);

// ─── Auth ──────────────────────────────────────────────────────────────────────

export async function loginRequest(
  credentials: LoginCredentials,
): Promise<AuthUser> {
  const { data } = await api.post<AuthUser>('/auth/login', credentials);
  return data;
}

export async function registerRequest(
  payload: RegisterPayload,
): Promise<AuthUser> {
  const { data } = await api.post<AuthUser>('/auth/register', payload);
  return data;
}

// ─── Prediction ────────────────────────────────────────────────────────────────

export async function predictSpecies(
  imageUri: string,
): Promise<PredictResponse> {
  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  const { data } = await api.post<PredictResponse>('/predict', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// ─── Sync Report ──────────────────────────────────────────────────────────────

export async function uploadReport(payload: SyncReportPayload): Promise<void> {
  const formData = new FormData();

  formData.append('image', {
    uri: payload.imageUri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  if (payload.audioUri) {
    formData.append('audio', {
      uri: payload.audioUri,
      name: 'recording.m4a',
      type: 'audio/mp4',
    } as unknown as Blob);
  }

  formData.append('id', payload.id);
  formData.append('latitude', String(payload.latitude));
  formData.append('longitude', String(payload.longitude));
  formData.append('timestamp', payload.timestamp);
  formData.append('notes', payload.notes);
  formData.append('userId', payload.userId);

  if (payload.prediction) {
    formData.append('prediction', JSON.stringify(payload.prediction));
  }

  await api.post('/reports', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

// ─── Fetch All Reports (for all users) ────────────────────────────────────────

export async function fetchAllReports(): Promise<InvasiveReport[]> {
  const { data } = await api.get<any[]>('/reports');
  return data.map((r) => ({
    id: r.id,
    imageUri: r.image_path ? `${API_BASE_URL}${r.image_path}` : '',
    audioUri: r.audio_path ? `${API_BASE_URL}${r.audio_path}` : undefined,
    coordinates: { latitude: r.latitude, longitude: r.longitude },
    timestamp: r.timestamp,
    notes: r.notes ?? '',
    prediction: r.prediction ?? null,
    syncStatus: 'uploaded' as const,
    userId: r.userId,
  }));
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

export interface AdminReport {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  notes: string;
  userId: string;
  userName: string;
  userEmail: string;
  prediction: {
    species_name: string;
    confidence_score: number;
    invasive_risk_level: string;
  } | null;
  has_image: boolean;
  has_audio: boolean;
  /** Relative path returned by backend, e.g. /uploads/abc_image.jpg */
  image_path: string;
  /** Full URL constructed client-side: API_BASE_URL + image_path */
  imageUrl: string;
  audio_path?: string;
  audioUrl?: string;
  created_at: number;
}

export interface AdminStats {
  total_reports: number;
  total_users: number;
  total_admins: number;
  high_risk_reports: number;
  species_distribution: Record<string, number>;
  users: Array<{ id: string; email: string; name: string; role: string }>;
}

export async function fetchAdminReports(): Promise<AdminReport[]> {
  const { data } = await api.get<AdminReport[]>('/admin/reports');
  // Build full image/audio URLs client-side so they are always correct regardless of
  // how the backend is accessed (local IP, ngrok, etc.)
  return data.map((r) => ({
    ...r,
    imageUrl: r.image_path ? `${API_BASE_URL}${r.image_path}` : '',
    audioUrl: r.audio_path ? `${API_BASE_URL}${r.audio_path}` : undefined,
  }));
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const { data } = await api.get<AdminStats>('/admin/stats');
  return data;
}

export default api;
