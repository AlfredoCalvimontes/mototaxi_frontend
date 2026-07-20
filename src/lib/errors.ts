import { ApiError, NetworkError } from '@/api/client';
import { strings } from '@/lib/strings';

/** Turns anything thrown by the API layer into a sentence for an operator. */
export function errorText(error: unknown): string {
  if (error instanceof NetworkError) return strings.common.networkError;
  if (error instanceof ApiError) return error.detail ?? strings.common.error;
  return strings.common.error;
}
