import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useId, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getCity, setCityActive, updateCity } from '@/api/admin';
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

export default function CityDetail() {
  const { tenantId, cityId } = useParams<{ tenantId: string; cityId: string }>();
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
      tenantId={tenantId!}
      city={city.data}
      onSaved={() => {
        void queryClient.invalidateQueries({ queryKey: ['city', cityId] });
        void queryClient.invalidateQueries({ queryKey: ['cities'] });
      }}
    />
  );
}

function CityForm({
  tenantId,
  city,
  onSaved,
}: {
  tenantId: string;
  city: City;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const initial = toValues(city);
  const [values, setValues] = useState<CityFormValues>(initial);
  const [validation, setValidation] = useState<Partial<Record<string, string>>>({});
  const geofenceId = useId();

  const { payload, unclearable } = cityChanges(initial, values);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{city.name}</h1>
        <div className="flex items-center gap-2">
          <span className={city.is_active ? 'text-emerald-700' : 'text-slate-500'}>
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

      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={`/tenants/${tenantId}/cities`}
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← {t.backToCities}
        </Link>
        {user && ADMIN.includes(user.role) && (
          <Link
            to={`/tenants/${tenantId}/cities/${city.city_id}/access`}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t.cityAccessLink}
          </Link>
        )}
      </div>

      <form onSubmit={handleSubmit} className="max-w-md space-y-4" noValidate>
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
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {save.isPending ? strings.common.loading : strings.common.save}
        </button>
      </form>

      <section aria-label={t.cityGeofenceMap} className="max-w-2xl space-y-2">
        <h2 className="text-sm font-medium text-slate-700">{t.cityGeofenceMap}</h2>
        {city.geofence_geojson ? (
          <Suspense fallback={<p className="text-sm text-slate-500">{strings.common.loading}</p>}>
            <GeofenceMap polygon={city.geofence_geojson} />
          </Suspense>
        ) : (
          <p className="text-sm text-slate-500">{t.cityGeofenceNone}</p>
        )}
      </section>
    </div>
  );
}
