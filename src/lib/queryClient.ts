import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/client';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Polling is the refresh mechanism (plan §4); a background tab should
        // not keep issuing requests overnight for ten motorcycles.
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
        staleTime: 5_000,
        retry(failureCount, error) {
          // The client already handled 401 by refreshing; retrying a 4xx just
          // repeats a request the server has already judged.
          if (error instanceof ApiError && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}
