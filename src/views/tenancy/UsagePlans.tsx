import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import {
  createUsagePlan,
  deleteUsagePlan,
  getUsagePlan,
  listDrivers,
  updateUsagePlan,
} from '@/api/admin';
import { queryKeys } from '@/api/queries';
import type { UsagePlan } from '@/api/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { Field, FormDialog } from '@/components/Field';
import { TableSkeleton } from '@/components/Skeleton';
import { ToneBadge } from '@/components/StatusBadge';
import { parseCredit } from '@/lib/dirty';
import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';
import { useUsagePlans } from '@/lib/useUsagePlans';
import { formatCredit } from '@/lib/usageCredit';

const t = strings.usagePlans;

/** What the form opens with: a stored plan, a preset (no rate is stored) or nothing. */
type Draft = { name: string; rental: boolean; price: string };

const PRESETS: { label: string; draft: Draft }[] = [
  { label: t.presetRental, draft: { name: t.presetRental, rental: true, price: '' } },
  { label: t.presetService, draft: { name: t.presetService, rental: false, price: '' } },
  { label: t.presetCustom, draft: { name: t.presetCustom, rental: false, price: '0' } },
];

type Dialog = { plan: UsagePlan | null; draft?: Draft } | null;

/** Where a price edit lands for the drivers on the plan. */
function priceImpact(
  before: number,
  after: number | null,
  drivers: number,
): 'none' | 'reprice' | 'toPaid' | 'toFree' {
  if (after === null || after === before || drivers === 0) return 'none';
  if (before === 0) return 'toPaid';
  if (after === 0) return 'toFree';
  return 'reprice';
}

function PlanForm({
  plan,
  draft,
  onClose,
}: {
  plan: UsagePlan | null;
  draft?: Draft;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const editing = plan !== null;
  const [name, setName] = useState(plan?.name ?? draft?.name ?? '');
  const [price, setPrice] = useState(plan ? String(plan.daily_credit) : (draft?.price ?? ''));
  const [rental, setRental] = useState(plan?.includes_vehicle_rental ?? draft?.rental ?? false);
  const [description, setDescription] = useState(plan?.description ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const [problems, setProblems] = useState<Partial<Record<'name' | 'price' | 'confirm', string>>>(
    {},
  );

  // The list has no driver count; the detail does, and it is what the server
  // checks a price change against, so ask for it rather than guess.
  const detail = useQuery({
    queryKey: queryKeys.usagePlan(plan?.usage_plan_uuid ?? ''),
    queryFn: () => getUsagePlan(plan!.usage_plan_uuid),
    enabled: editing,
  });
  const drivers = detail.data?.driver_count ?? 0;
  const amount = parseCredit(price);
  const validPrice = amount !== null && Number.isFinite(amount) && amount >= 0;
  const impact = editing
    ? priceImpact(plan.daily_credit, validPrice ? amount : null, drivers)
    : 'none';
  const crossesZero = impact === 'toPaid' || impact === 'toFree';

  const save = useMutation({
    mutationFn: () => {
      const text = description.trim();
      if (!editing) {
        return createUsagePlan({
          name: name.trim(),
          daily_credit: amount!,
          includes_vehicle_rental: rental,
          ...(text && { description: text }),
        });
      }
      return updateUsagePlan(plan.usage_plan_uuid, {
        ...(name.trim() !== plan.name && { name: name.trim() }),
        ...(amount !== plan.daily_credit && { daily_credit: amount! }),
        ...(rental !== plan.includes_vehicle_rental && { includes_vehicle_rental: rental }),
        ...((plan.description ?? '') !== text && { description: text || null }),
        ...(crossesZero && { confirm_affected_drivers: drivers }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.usagePlans });
      // A re-price moves every driver's expiry.
      void queryClient.invalidateQueries({ queryKey: ['drivers'] });
      void queryClient.invalidateQueries({ queryKey: ['driver'] });
      onClose();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const errors: typeof problems = {};
    if (!name.trim()) errors.name = strings.fleet.requiredField;
    if (!validPrice) errors.price = t.dailyCreditInvalid;
    if (crossesZero && !confirmed) errors.confirm = t.confirmAffected(drivers);
    setProblems(errors);
    if (Object.keys(errors).length > 0) return;
    save.mutate();
  }

  return (
    <FormDialog title={editing ? t.editPlan : t.newPlan} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t.name} value={name} onChange={setName} required error={problems.name} />
        <Field
          label={t.dailyCredit}
          value={price}
          onChange={setPrice}
          required
          hint={t.dailyCreditHint}
          error={problems.price}
        />
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={rental} onChange={(e) => setRental(e.target.checked)} />
            {t.rental}
          </label>
          <p className="text-xs text-slate-500">{t.rentalHint}</p>
        </div>
        <Field label={t.description} value={description} onChange={setDescription} />

        {impact === 'reprice' && (
          <p
            role="alert"
            className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            {t.repriceWarning(drivers)}
          </p>
        )}
        {crossesZero && (
          <div
            role="alert"
            className="space-y-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            <p>{impact === 'toPaid' ? t.toPaidWarning(drivers) : t.toFreeWarning(drivers)}</p>
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              {t.confirmAffected(drivers)}
            </label>
            {problems.confirm && <p className="text-red-800">{problems.confirm}</p>}
          </div>
        )}

        {save.error != null && (
          <p
            role="alert"
            className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {errorText(save.error)}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {strings.common.cancel}
          </button>
          <button
            type="submit"
            disabled={save.isPending || (editing && detail.isPending)}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {save.isPending ? strings.common.loading : strings.common.save}
          </button>
        </div>
      </form>
    </FormDialog>
  );
}

export default function UsagePlans() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [deleting, setDeleting] = useState<UsagePlan | null>(null);
  const plans = useUsagePlans();
  // The list carries no counts, so tally them from the drivers; the server
  // still refuses to delete a plan that has any.
  const drivers = useQuery({ queryKey: ['drivers', 'all', 'all'], queryFn: () => listDrivers() });
  const countOf = (plan: UsagePlan) =>
    (drivers.data ?? []).filter((d) => d.usage_plan_uuid === plan.usage_plan_uuid).length;

  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.usagePlans });
  const toggle = useMutation({
    mutationFn: (plan: UsagePlan) =>
      updateUsagePlan(plan.usage_plan_uuid, { is_active: !plan.is_active }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (plan: UsagePlan) => deleteUsagePlan(plan.usage_plan_uuid),
    onSuccess: () => {
      refresh();
      setDeleting(null);
    },
  });

  if (plans.isPending) return <TableSkeleton rows={3} />;
  if (plans.isError) return <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />;

  const columns: Column<UsagePlan>[] = [
    {
      id: 'name',
      header: t.name,
      sortValue: (x) => x.name,
      cell: (x) => <span className="font-medium text-slate-900">{x.name}</span>,
    },
    {
      id: 'price',
      header: t.dailyCredit,
      align: 'right',
      sortValue: (x) => x.daily_credit,
      cell: (x) => (x.daily_credit === 0 ? t.free : t.perDay(formatCredit(x.daily_credit))),
    },
    {
      id: 'rental',
      header: t.rental,
      secondary: true,
      cell: (x) => (x.includes_vehicle_rental ? t.includesRental : t.serviceOnly),
    },
    {
      id: 'drivers',
      header: t.drivers,
      align: 'right',
      sortValue: countOf,
      cell: (x) => countOf(x),
    },
    {
      id: 'status',
      header: t.status,
      sortValue: (x) => (x.is_active ? 0 : 1),
      cell: (x) => (
        <ToneBadge tone={x.is_active ? 'good' : 'neutral'}>
          {x.is_active ? t.active : t.archived}
        </ToneBadge>
      ),
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (x) => (
        <div className="flex justify-end gap-3 text-sm">
          <button type="button" className="underline" onClick={() => setDialog({ plan: x })}>
            {strings.common.edit}
          </button>
          <button
            type="button"
            className="underline"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate(x)}
          >
            {x.is_active ? t.archive : t.restore}
          </button>
          {drivers.isSuccess && countOf(x) === 0 && (
            <button type="button" className="text-red-700 underline" onClick={() => setDeleting(x)}>
              {t.delete}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">{t.heading}</h1>
        <button
          type="button"
          onClick={() => setDialog({ plan: null })}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t.newPlan}
        </button>
      </div>
      <p className="text-sm text-slate-600">{t.intro}</p>
      <p className="text-xs text-slate-500">{t.archiveHint}</p>
      {toggle.error != null && (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {errorText(toggle.error)}
        </p>
      )}
      {plans.data.length === 0 ? (
        <div className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
          <p className="text-sm text-slate-600">{t.empty}</p>
          <p className="text-sm text-slate-500">{t.emptyPresetsIntro}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setDialog({ plan: null, draft: preset.draft })}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <DataTable
          rows={plans.data}
          columns={columns}
          rowKey={(x) => x.usage_plan_uuid}
          caption={t.heading}
          emptyMessage={t.empty}
        />
      )}
      {dialog && (
        <PlanForm plan={dialog.plan} draft={dialog.draft} onClose={() => setDialog(null)} />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? t.deleteTitle(deleting.name) : ''}
        body={deleting ? t.deleteBody(deleting.name) : ''}
        confirmLabel={t.delete}
        pending={remove.isPending}
        error={remove.error}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
