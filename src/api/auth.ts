import { request } from '@/api/client';
import type { TokenPair, UserProfile } from '@/api/types';

/**
 * The login endpoint is an OAuth2 password form, so the credentials go
 * form-encoded with `username` carrying the email.
 *
 * The returned tokens are ignored on purpose: the same response sets httpOnly
 * cookies, and those are what every later request uses.
 */
export function login(email: string, password: string): Promise<TokenPair> {
  return request<TokenPair>('/users/login', {
    method: 'POST',
    form: { username: email, password },
    // A 401 here is bad credentials, not an expired session — refreshing would
    // be meaningless and would bounce the user off the login screen they are
    // already on.
    skipAuthRefresh: true,
  });
}

/** Session bootstrap: cookies are httpOnly, so only the server can answer this. */
export function fetchProfile(): Promise<UserProfile> {
  return request<UserProfile>('/users/me');
}

export async function logout(): Promise<void> {
  // Body required by the endpoint; the refresh token itself comes from the cookie.
  await request<void>('/users/logout', { method: 'POST', json: {}, skipAuthRefresh: true });
}
