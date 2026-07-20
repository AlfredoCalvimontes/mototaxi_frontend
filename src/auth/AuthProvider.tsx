import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as authApi from '@/api/auth';
import { setSessionExpiredHandler } from '@/api/client';
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

  // The API client cannot navigate; it reports a dead session and this decides
  // what that means for the UI.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser((current) => {
        if (current) setExpired(true);
        return null;
      });
      setStatus('anonymous');
      queryClient.clear();
    });
    return () => setSessionExpiredHandler(null);
  }, [queryClient]);

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
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(
    () => ({ status, user, expired, signIn, signOut }),
    [status, user, expired, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
