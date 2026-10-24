import { expect, test, type Route } from '@playwright/test';

/**
 * A superadmin switching between two companies in the real SPA. The API is
 * mocked at the network edge (`page.route`), keyed on the `X-Tenant-Id` header
 * the SPA sends, so the check is what the browser asks for and shows — not a
 * backend. Run it against the dev VM by dropping the mock.
 */

const ACME = { id: '11111111-1111-4111-8111-111111111111', name: 'Acme Taxis' };
const BETA = { id: '22222222-2222-4222-8222-222222222222', name: 'Beta Motos' };

const tenant = (t: { id: string; name: string }) => ({
  tenant_id: t.id,
  name: t.name,
  slug: t.name.toLowerCase().replace(' ', '-'),
  contact_email: null,
  contact_phone: null,
  is_active: true,
  created_at: '2026-10-01T10:00:00Z',
});

const driver = (name: string) => ({
  driver_uuid: crypto.randomUUID(),
  name,
  ci: '1234567',
  phone_whatsapp: '+59171234567',
  license_number: null,
  status: 'AVAILABLE',
  has_checked_in_today: true,
  current_vehicle_uuid: null,
  lat: null,
  lon: null,
  location_updated_at: null,
  location_source: null,
  usage_credit_enabled: false,
  usage_credit_balance: null,
  usage_credit_expires_at: null,
  usage_credit_expired: false,
  created_at: '2026-10-01T10:00:00Z',
  city_uuid: null,
});

const json = (route: Route, body: unknown) => route.fulfill({ json: body });

test('switching company swaps the data and always names who you act as', async ({ page }) => {
  const driverRequests: (string | undefined)[] = [];

  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url());
    const acting = route.request().headers()['x-tenant-id'];
    switch (url.pathname.replace('/api/v1', '')) {
      case '/users/me':
        return json(route, {
          user_uuid: crypto.randomUUID(),
          email: 'root@example.com',
          role: 'SUPERADMIN',
          tenant_id: null,
          city_uuids: [],
        });
      case '/admin/tenants':
        return json(route, {
          items: [tenant(ACME), tenant(BETA)],
          total: 2,
          page: 1,
          page_size: 100,
          pages: 1,
        });
      case '/admin/drivers':
        driverRequests.push(acting);
        return json(route, [
          driver(
            acting === ACME.id ? 'Ana de Acme' : acting === BETA.id ? 'Beto de Beta' : 'Todos',
          ),
        ]);
      default:
        return json(route, []);
    }
  });

  await page.goto('/conductores');
  await expect(page.getByText('Todos', { exact: true })).toBeVisible();
  await expect(page.getByText(/Actuando como/)).toHaveCount(0);

  const switcher = page.getByLabel('Actuar como');
  await switcher.selectOption(ACME.id);
  await expect(page.getByText(`Actuando como ${ACME.name}`)).toBeVisible();
  await expect(page.getByText('Ana de Acme')).toBeVisible();
  await expect(page.getByText('Todos', { exact: true })).toHaveCount(0);

  await switcher.selectOption(BETA.id);
  await expect(page.getByText(`Actuando como ${BETA.name}`)).toBeVisible();
  await expect(page.getByText('Beto de Beta')).toBeVisible();
  // The previous company's rows never linger under the new banner.
  await expect(page.getByText('Ana de Acme')).toHaveCount(0);

  expect(driverRequests).toContain(ACME.id);
  expect(driverRequests).toContain(BETA.id);
});
