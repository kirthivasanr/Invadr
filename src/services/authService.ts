/**
 * authService.ts
 * Manages authentication state using Expo SecureStore.
 * Supports login and registration with the backend.
 */
import * as SecureStore from 'expo-secure-store';
import { AuthUser, LoginCredentials } from '../types';
import { loginRequest, registerRequest } from './apiService';

const TOKEN_KEY = 'invadr_token';
const USER_KEY = 'invadr_user';

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  phone?: string;
  home_location?: string;
  home_latitude?: number;
  home_longitude?: number;
}

export async function login(credentials: LoginCredentials): Promise<AuthUser> {
  const user = await loginRequest(credentials);
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, user.token),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
  ]);
  return user;
}

export async function register(payload: RegisterPayload): Promise<AuthUser> {
  const user = await registerRequest(payload);
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, user.token),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
  ]);
  return user;
}

export async function logout(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}

export async function getStoredUser(): Promise<AuthUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export async function getStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}
