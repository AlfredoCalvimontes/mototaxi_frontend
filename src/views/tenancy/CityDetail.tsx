import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useId, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getCity, listCityAccess, setCityActive, updateCity } from '@/api/admin';
import type { City } from '@/api/types';
import { useAuth } from '@/auth/context';
import { ADMIN } from '@/auth/roles';
import { ActiveToggle } from '@/components/ActiveToggle';
import { ErrorState } from '@/components/ErrorState';
import { Field } from '@/components/Field';
import { TableSkeleton } from '@/components/Skeleton';
import { cityChanges, hasChanges, type CityFormValues } from '@/lib/dirty';
import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';

const t = strings.tenancy;

// Leaflet is heavy and only this view and the fleet map need it.
const GeofenceMap = lazy(() =>
  import('@/components/GeofenceMap').then((module) => ({ default: module.GeofenceMap })),
);

function toValues(city: City): CityFormValues {
  return { name: city.name, timezone: city.timezone, geofence_wkt: city.geofence_wkt ?? '' };
}

/** A titled white card; every block of the detail page uses it. */
function Card({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section aria-label={title} className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </header>
      <div className="p-5">{children}</div>
      {footer && <footer className="border-t border-slate-100 px-5 py-3">{footer}</footer>}
    </section>
  );
}

/**
 * The city's own page. Reached from the platform list (`/cities/:cityId`, the city
 * tells us its empresa) or from an empresa's list (`/tenants/:tenantId/cities/:cityId`).
 */
export default function CityDetail() {
  const { tenantId, cityId } = useParams<{ tenantId?: string; cityId: string }>();
  const queryClient = useQueryClient();

  const city = useQuery({
    queryKey: ['city', cityId],
    queryFn: () => getCity(cityId!),
    enabled: !!cityId,
  });

  if (city.isPending) return <TableSkeleton rows={3} />;
  if (city.isError) return <ErrorState error={city.error} onRetry={() => void city.refetch()} />;

  return (
    <CityForm
      inTenantPath={!!tenantId}
      city={city.data}
      onSaved={() => {
        void queryClient.invalidateQueries({ queryKey: ['city', cityId] });
        void queryClient.invalidateQueries({ queryKey: ['cities'] });
      }}
    />
  );
}

function CityForm({
  inTenantPath,
  city,
  onSaved,
}: {
  inTenantPath: boolean;
  city: City;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const initial = toValues(city);
  const [values, setValues] = useState<CityFormValues>(initial);
  const [validation, setValidation] = useState<Partial<Record<string, string>>>({});
  const geofenceId = useId();

  const { payload, unclearable } = cityChanges(initial, values);

  // The city's empresa owns its access list; the tenant path already names it.
  const back = inTenantPath ? `/tenants/${city.tenant_id}/cities` : '/cities';
  const accessPath = `/cities/${city.city_id}/access`;
  const access = useQuery({
    queryKey: ['city-access', city.city_id],
    queryFn: () => listCityAccess(city.city_id),
    enabled: !!user && ADMIN.includes(user.role),
  });

  const save = useMutation({
    mutationFn: () => updateCity(city.city_id, payload),
    onSuccess: onSaved,
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!values.name.trim()) errors.name = strings.fleet.requiredField;
    if (!values.timezone.trim()) errors.timezone = strings.fleet.requiredField;
    setValidation(errors);
    if (Object.keys(errors).length > 0 || !hasChanges(payload)) return;
    save.mutate();
  }

  const canManageAccess = !!user && ADMIN.includes(user.role);

  return (
    <div className="space-y-6">
      <Link to={back} className="text-sm font-medium text-slate-600 hover:text-slate-900">
        ← {t.backToCities}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-slate-900">{city.name}</h1>
          <p className="text-sm text-slate-500">{city.timezone}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              city.is_active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {city.is_active ? t.cityActive : t.cityInactive}
          </span>
          <ActiveToggle
            active={city.is_active}
            activateLabel={t.activate}
            deactivateLabel={t.deactivate}
            confirmTitle={t.deactivateCityTitle}
            confirmBody={t.deactivateCityBody(city.name)}
            toggle={(next) => setCityActive(city.city_id, next)}
            onDone={onSaved}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card title={t.cityDataHeading}>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t.cityName}
                  value={values.name}
                  onChange={(name) => setValues((v) => ({ ...v, name }))}
                  required
                  error={validation.name}
                />
                <Field
                  label={t.cityTimezone}
                  value={values.timezone}
                  onChange={(timezone) => setValues((v) => ({ ...v, timezone }))}
                  required
                  hint={t.cityTimezoneHint}
                  error={validation.timezone}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor={geofenceId} className="block text-sm font-medium text-slate-700">
                  {t.cityGeofence}
                </label>
                <textarea
                  id={geofenceId}
                  value={values.geofence_wkt}
                  onChange={(e) => setValues((v) => ({ ...v, geofence_wkt: e.target.value }))}
                  rows={4}
                  className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs focus:border-slate-500 focus:outline-none"
                />
                <p className="text-xs text-slate-500">{t.cityGeofenceHint}</p>
              </div>

              {unclearable.length > 0 && (
                <p
                  role="alert"
                  className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                >
                  {strings.fleet.cannotClearFields}
                </p>
              )}
              {save.error != null && (
                <p
                  role="alert"
                  className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                >
                  {errorText(save.error)}
                </p>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={save.isPending}
                  className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {save.isPending ? strings.common.loading : strings.common.save}
                </button>
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card title={t.cityGeofenceMap}>
            {city.geofence_geojson ? (
              <Suspense
                fallback={<p className="text-sm text-slate-500">{strings.common.loading}</p>}
              >
                <GeofenceMap
                  polygon={city.geofence_geojson}
                  className="h-72 w-full rounded-md border border-slate-200"
                />
              </Suspense>
            ) : (
              <p className="text-sm text-slate-500">{t.cityGeofenceNone}</p>
            )}
          </Card>

          {canManageAccess && (
            <Card
              title={t.cityAccessHeading}
              footer={
                <Link
                  to={accessPath}
                  className="inline-flex rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t.cityManage}
                </Link>
              }
            >
              <p className="text-sm text-slate-600">{t.cityAccessCardHint}</p>
              {access.data && (
                <p className="mt-3 text-sm font-medium text-slate-800">
                  {t.cityAccessCount(access.data.length)}
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
