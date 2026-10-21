import { createContext, useContext } from 'react';

import type { UserProfile } from '@/api/types';

export type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

export type AuthContextValue = {
  status: AuthStatus;
  user: UserProfile | null;
  /** True once a session ended because a refresh failed, not by logging out. */
  expired: boolean;
  /** Tenant a superadmin is acting as; `null` for everyone else or when none is picked. */
  actingAsTenant: string | null;
  /** Superadmin only. Drops every cached query so no row of the previous tenant survives. */
  setActingAsTenant: (tenantId: string | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return value;
}
