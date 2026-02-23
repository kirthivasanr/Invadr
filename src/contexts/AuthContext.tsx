/**
 * AuthContext.tsx
 * Provides authentication state across the entire app.
 * Supports login, registration, and role-based routing.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { AuthUser, LoginCredentials } from '../types';
import { login, register, logout, getStoredUser } from '../services/authService';

interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  phone?: string;
  home_location?: string;
  home_latitude?: number;
  home_longitude?: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (credentials: LoginCredentials) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate on mount
  useEffect(() => {
    getStoredUser()
      .then(setUser)
      .finally(() => setIsLoading(false));
  }, []);

  const signIn = useCallback(async (credentials: LoginCredentials) => {
    const authUser = await login(credentials);
    setUser(authUser);
  }, []);

  const signUp = useCallback(async (payload: RegisterPayload) => {
    const authUser = await register(payload);
    setUser(authUser);
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
