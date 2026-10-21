import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as authApi from '@/api/auth';
import { setActAsTenant, setSessionExpiredHandler } from '@/api/client';
import type { UserProfile } from '@/api/types';
import { AuthContext, type AuthStatus } from '@/auth/context';

/**
 * Session state.
 *
 * The tokens live in httpOnly cookies, so "am I signed in?" cannot be answered
 * from JS — it is a `GET /users/me` on mount. Until that call settles the
 * status is `checking`, which is what keeps `RequireAuth` from bouncing a
 * perfectly valid session to the login screen on a page refresh.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [expired, setExpired] = useState(false);
  const [actingAsTenant, setActingAsTenantState] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    authApi
      .fetchProfile()
      .then((profile) => {
        if (cancelled) return;
        setUser(profile);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        // A 401 here is the ordinary "not signed in yet" case on first load,
        // so it must not raise the expired notice.
        setUser(null);
        setStatus('anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Act-as lives in memory only: a reload or a new login starts unscoped
  // rather than silently writing into a tenant the operator forgot about.
  const resetActAs = useCallback(() => {
    setActAsTenant(null);
    setActingAsTenantState(null);
  }, []);

  const setActingAsTenant = useCallback(
    (tenantId: string | null) => {
      setActAsTenant(tenantId);
      setActingAsTenantState(tenantId);
      // `reset`, not `clear`: mounted views must refetch under the new tenant,
      // and `clear` would leave them holding detached queries.
      void queryClient.resetQueries();
    },
    [queryClient],
  );

  // The API client cannot navigate; it reports a dead session and this decides
  // what that means for the UI.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser((current) => {
        if (current) setExpired(true);
        return null;
      });
      setStatus('anonymous');
      resetActAs();
      queryClient.clear();
    });
    return () => setSessionExpiredHandler(null);
  }, [queryClient, resetActAs]);

  const signIn = useCallback(async (email: string, password: string) => {
    await authApi.login(email, password);
    const profile = await authApi.fetchProfile();
    setUser(profile);
    setExpired(false);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // The cookies may already be gone. Signing out must not fail visibly —
      // clearing local state is what the operator asked for either way.
    }
    setUser(null);
    setExpired(false);
    setStatus('anonymous');
    resetActAs();
    queryClient.clear();
  }, [queryClient, resetActAs]);

  const value = useMemo(
    () => ({ status, user, expired, actingAsTenant, setActingAsTenant, signIn, signOut }),
    [status, user, expired, actingAsTenant, setActingAsTenant, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
