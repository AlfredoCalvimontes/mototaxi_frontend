import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { server } from '@/test/server';

// jsdom has no scrollTo, and Leaflet calls it when a popup opens. Left alone it
// prints "Not implemented" for every map test, which buries real output.
vi.stubGlobal('scrollTo', vi.fn());

// Unhandled requests are an error: a view that quietly hits an endpoint the
// contract does not define should fail the suite, not fall through to network.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
