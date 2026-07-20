import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { ApiError, NetworkError } from '@/api/client';
import { useAuth } from '@/auth/context';
import { strings } from '@/lib/strings';

type LocationState = { from?: { pathname?: string } };

function errorMessage(error: unknown): string {
  if (error instanceof NetworkError) return strings.common.networkError;
  if (error instanceof ApiError) {
    if (error.status === 401) return strings.login.invalid;
    // The login route is rate limited server-side (5 per 15 min per IP);
    // saying so beats a generic failure the operator would just retry into.
    if (error.status === 429) return strings.login.rateLimited;
    return error.detail ?? strings.common.error;
  }
  return strings.common.error;
}

export default function Login() {
  const { status, expired, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') {
    const from = (location.state as LocationState | null)?.from?.pathname;
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError(strings.login.required);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (caught) {
      setError(errorMessage(caught));
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-sm"
        noValidate
      >
        <header>
          <h1 className="text-lg font-semibold text-slate-900">{strings.login.heading}</h1>
          <p className="text-sm text-slate-500">
            {strings.app.title} — {strings.app.city}
          </p>
        </header>

        {expired && (
          <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {strings.session.expired}
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            {strings.login.email}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            {strings.login.password}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting ? strings.login.submitting : strings.login.submit}
        </button>
      </form>
    </main>
  );
}
