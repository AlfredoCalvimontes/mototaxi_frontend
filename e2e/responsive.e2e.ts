import { expect, test } from '@playwright/test';

/** Phone width: no screen may scroll the page sideways (tables scroll inside their own box). */
const ROUTES = [
  '/',
  '/viajes',
  '/vehiculos',
  '/vehiculos/tipos',
  '/conductores',
  '/historial',
  '/clientes',
  '/configuracion',
  '/tenants',
  '/whatsapp',
  '/plataforma',
];

// Long values on purpose: that is what pushes a table past the viewport.
const DRIVER = {
  driver_uuid: crypto.randomUUID(),
  name: 'Maria de los Angeles Fernandez Condori',
  ci: '1234567',
  phone_whatsapp: '+59171234567',
  license_number: 'LIC-0001',
  status: 'AVAILABLE',
  has_checked_in_today: true,
  current_vehicle_uuid: null,
  lat: null,
  lon: null,
  location_updated_at: null,
  location_source: null,
  usage_credit_enabled: false,
  usage_credit_balance: null,
  usage_credit_expires_on: null,
  usage_credit_expired: false,
  created_at: '2026-10-01T10:00:00Z',
  city_uuid: null,
};
const VEHICLE = {
  vehicle_uuid: crypto.randomUUID(),
  plate_number: '1234-ABC',
  alias: 'El rapido de la plaza principal',
  status: 'AVAILABLE',
  lat: null,
  lon: null,
  location_updated_at: null,
  location_source: null,
  has_tracker: false,
  sim_last_recharge_at: null,
  sim_last_recharge_amount: null,
  sim_next_recharge_at: null,
  is_tracker_stale: false,
  current_driver_uuid: null,
  city_uuid: null,
  vehicle_type_uuid: null,
};

test.use({ viewport: { width: 375, height: 800 } });

test('no screen overflows horizontally at phone width', async ({ page }) => {
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    if (path === '/users/me') {
      return route.fulfill({
        json: {
          user_uuid: crypto.randomUUID(),
          email: 'root@example.com',
          role: 'SUPERADMIN',
          tenant_id: null,
          city_uuids: [],
        },
      });
    }
    if (path === '/admin/tenants' || path === '/admin/audit-logs') {
      return route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 100, pages: 1 } });
    }
    if (path === '/admin/drivers') return route.fulfill({ json: [DRIVER] });
    if (path === '/admin/vehicles') return route.fulfill({ json: [VEHICLE] });
    return route.fulfill({ json: [] });
  });

  // A screen that crashed on the mock would "fit" trivially; make that a failure.
  const crashes: string[] = [];
  page.on('pageerror', (error) => crashes.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /error occurred in the/.test(message.text())) {
      crashes.push(message.text().slice(0, 120));
    }
  });

  for (const path of ROUTES) {
    crashes.length = 0;
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(crashes, `${path} crashed`).toEqual([]);
    expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  }
});
