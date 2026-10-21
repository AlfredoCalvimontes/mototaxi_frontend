import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getCity, grantCityAccess, listCityAccess, revokeCityAccess } from '@/api/admin';
import { listUsers } from '@/api/auth';
import { useAuth } from '@/auth/context';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState } from '@/components/ErrorState';
import { Field, SelectField } from '@/components/Field';
import { TableSkeleton } from '@/components/Skeleton';
import { formatDateTime } from '@/lib/format';
import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';

const t = strings.tenancy;
const SCOPED_ROLES = ['CITY_ADMIN', 'OPERATOR'];

/**
 * Who may work in this city. The user list is superadmin-only on the backend,
 * so a tenant admin pastes a user ID instead of picking from a list.
 */
export default function CityAccessManager() {
  const { tenantId, cityId } = useParams<{ tenantId: string; cityId: string }>();
  const { user } = useAuth();
  const isSuper = user?.role === 'SUPERADMIN';
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState('');
  const [revoking, setRevoking] = useState<string | null>(null);

  const city = useQuery({ queryKey: ['city', cityId], queryFn: () => getCity(cityId!) });
  const grants = useQuery({
    queryKey: ['city-access', cityId],
    queryFn: () => listCityAccess(cityId!),
  });
  const users = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => listUsers({ page_size: 100 }),
    enabled: isSuper,
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['city-access', cityId] });

  const grant = useMutation({
    mutationFn: (userId: string) => grantCityAccess(cityId!, { user_id: userId }),
    onSuccess: () => {
      setSelected('');
      refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: (userId: string) => revokeCityAccess(cityId!, userId),
    onSuccess: () => {
      setRevoking(null);
      refresh();
    },
  });

  if (grants.isPending || city.isPending) return <TableSkeleton rows={3} />;
  if (grants.isError)
    return <ErrorState error={grants.error} onRetry={() => void grants.refetch()} />;

  const people = new Map((users.data?.items ?? []).map((u) => [u.user_uuid, u]));
  const granted = new Set(grants.data.map((g) => g.user_id));
  const eligible = [...people.values()].filter(
    (u) => SCOPED_ROLES.includes(u.role) && u.tenant_id === tenantId && !granted.has(u.user_uuid),
  );
  const labelFor = (userId: string) => {
    const person = people.get(userId);
    return person ? `${person.name} ${person.first_lastname} (${person.role})` : userId;
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    if (selected.trim()) grant.mutate(selected.trim());
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900">{t.cityAccessHeading}</h1>
        {city.data && <p className="text-sm text-slate-600">{city.data.name}</p>}
        <Link
          to={`/tenants/${tenantId}/cities/${cityId}`}
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← {t.backToCities}
        </Link>
      </div>

      {grants.data.length === 0 ? (
        <p className="text-sm text-slate-500">{t.cityAccessNoGrants}</p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">{t.cityAccessHeading}</caption>
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1 font-medium">{t.cityAccessUser}</th>
              <th className="py-1 font-medium">{t.cityAccessGrantedSince}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {grants.data.map((g) => (
              <tr key={g.user_city_access_id} className="border-t border-slate-100">
                <td className="py-2">{labelFor(g.user_id)}</td>
                <td className="py-2">{formatDateTime(g.created_at)}</td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setRevoking(g.user_id)}
                    className="text-red-700 underline"
                  >
                    {t.cityAccessRevoke}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={submit} className="space-y-3 rounded border border-slate-200 p-3">
        {isSuper ? (
          <SelectField
            label={t.cityAccessSelectUser}
            value={selected}
            onChange={setSelected}
            hint={
              eligible.length === 0 && !users.isPending ? t.cityAccessNoEligibleUsers : undefined
            }
            options={[
              { value: '', label: '—' },
              ...eligible.map((u) => ({ value: u.user_uuid, label: labelFor(u.user_uuid) })),
            ]}
          />
        ) : (
          <Field
            label={t.cityAccessUserId}
            value={selected}
            onChange={setSelected}
            hint={t.cityAccessUserIdHint}
          />
        )}
        {grant.error != null && (
          <p
            role="alert"
            className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {errorText(grant.error)}
          </p>
        )}
        <button
          type="submit"
          disabled={!selected.trim() || grant.isPending}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {t.cityAccessGrant}
        </button>
      </form>

      <ConfirmDialog
        open={revoking !== null}
        title={t.cityAccessRevoke}
        body={revoking ? `${labelFor(revoking)} — ${city.data?.name ?? ''}` : ''}
        confirmLabel={t.cityAccessRevoke}
        destructive
        pending={revoke.isPending}
        error={revoke.error}
        onConfirm={() => revoking && revoke.mutate(revoking)}
        onClose={() => setRevoking(null)}
      />
    </div>
  );
}
