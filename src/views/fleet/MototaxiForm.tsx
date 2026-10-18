import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { createMototaxi, updateMototaxi } from '@/api/admin';
import type { Mototaxi } from '@/api/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Field, FormDialog } from '@/components/Field';
import { hasChanges, mototaxiChanges, parseCredit, type MototaxiFormValues } from '@/lib/dirty';
import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';

function toValues(unit: Mototaxi): MototaxiFormValues {
  return {
    plate_number: unit.plate_number,
    alias: unit.alias ?? '',
    brand: unit.brand ?? '',
    model: unit.model ?? '',
    tracker_imei: unit.tracker_imei ?? '',
    sim_last_recharge_at: unit.sim_last_recharge_at ?? '',
    sim_last_recharge_amount:
      unit.sim_last_recharge_amount === null ? '' : String(unit.sim_last_recharge_amount),
    notes: unit.notes ?? '',
    last_maintenance_at: unit.last_maintenance_at ?? '',
  };
}

const emptyValues: MototaxiFormValues = {
  plate_number: '',
  alias: '',
  brand: '',
  model: '',
  tracker_imei: '',
  sim_last_recharge_at: '',
  sim_last_recharge_amount: '',
  notes: '',
  last_maintenance_at: '',
};

/** The date and the credit go together; one without the other cannot give a next date. */
function simErrors(values: MototaxiFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const hasDate = values.sim_last_recharge_at.trim() !== '';
  const hasAmount = values.sim_last_recharge_amount.trim() !== '';
  if (hasDate !== hasAmount) {
    errors[hasDate ? 'simAmount' : 'simDate'] = strings.fleet.simBothRequired;
  } else if (hasAmount) {
    const amount = parseCredit(values.sim_last_recharge_amount);
    if (amount === null || !Number.isFinite(amount) || amount <= 0) {
      errors.simAmount = strings.fleet.simAmountInvalid;
    }
  }
  return errors;
}

export function MototaxiForm({
  mototaxi,
  onClose,
}: {
  mototaxi: Mototaxi | null;
  onClose: () => void;
}) {
  const editing = mototaxi !== null;
  const initial = mototaxi ? toValues(mototaxi) : emptyValues;
  const queryClient = useQueryClient();

  const [values, setValues] = useState<MototaxiFormValues>(initial);
  const [validation, setValidation] = useState<Partial<Record<string, string>>>({});
  const [confirmingDetach, setConfirmingDetach] = useState(false);

  const { payload, detachesTracker } = mototaxiChanges(initial, values);
  const hasTracker = values.tracker_imei.trim() !== '';

  const save = useMutation({
    mutationFn: async () => {
      if (editing) return updateMototaxi(mototaxi.mototaxi_uuid, payload);
      return createMototaxi({
        plate_number: values.plate_number.trim(),
        alias: values.alias.trim() || null,
        brand: values.brand.trim() || null,
        model: values.model.trim() || null,
        tracker_imei: values.tracker_imei.trim() || null,
        ...(hasTracker && values.sim_last_recharge_at
          ? {
              sim_last_recharge_at: values.sim_last_recharge_at,
              sim_last_recharge_amount: parseCredit(values.sim_last_recharge_amount),
            }
          : {}),
        notes: values.notes.trim() || null,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mototaxis'] });
      void queryClient.invalidateQueries({ queryKey: ['mototaxi'] });
      setConfirmingDetach(false);
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!values.plate_number.trim()) errors.plate = strings.fleet.requiredField;
    if (hasTracker) Object.assign(errors, simErrors(values));
    setValidation(errors);
    if (Object.keys(errors).length > 0) return;
    if (editing && !hasChanges(payload)) {
      onClose();
      return;
    }
    // Detaching the tracker drops the IMEI from the GT06 allowlist, so it is
    // never something the operator reaches by tabbing through and saving.
    if (detachesTracker) {
      setConfirmingDetach(true);
      return;
    }
    save.mutate();
  }

  return (
    <>
      <FormDialog
        title={editing ? strings.fleet.editMototaxi : strings.fleet.newMototaxi}
        onClose={onClose}
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Field
            label={strings.mototaxis.plate}
            value={values.plate_number}
            onChange={(plate_number) => setValues((v) => ({ ...v, plate_number }))}
            required
            error={validation.plate}
          />

          <Field
            label={strings.mototaxis.alias}
            value={values.alias}
            onChange={(alias) => setValues((v) => ({ ...v, alias }))}
            hint={strings.fleet.aliasHint}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={strings.mototaxis.brand}
              value={values.brand}
              onChange={(brand) => setValues((v) => ({ ...v, brand }))}
            />
            <Field
              label={strings.mototaxis.model}
              value={values.model}
              onChange={(model) => setValues((v) => ({ ...v, model }))}
            />
          </div>

          <Field
            label={strings.mototaxis.imei}
            value={values.tracker_imei}
            onChange={(tracker_imei) => setValues((v) => ({ ...v, tracker_imei }))}
            hint={strings.fleet.imeiHint}
          />

          {hasTracker && (
            <fieldset className="space-y-3 rounded border border-slate-200 p-3">
              <legend className="px-1 text-sm font-medium text-slate-700">
                {strings.fleet.simSection}
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={strings.fleet.simLastRechargeField}
                  type="date"
                  value={values.sim_last_recharge_at}
                  onChange={(sim_last_recharge_at) =>
                    setValues((v) => ({ ...v, sim_last_recharge_at }))
                  }
                  error={validation.simDate}
                />
                <Field
                  label={strings.fleet.simAmountField}
                  value={values.sim_last_recharge_amount}
                  onChange={(sim_last_recharge_amount) =>
                    setValues((v) => ({ ...v, sim_last_recharge_amount }))
                  }
                  hint={strings.fleet.simAmountHint}
                  error={validation.simAmount}
                />
              </div>
            </fieldset>
          )}

          <Field
            label={strings.mototaxis.lastMaintenance}
            type="date"
            value={values.last_maintenance_at}
            onChange={(last_maintenance_at) => setValues((v) => ({ ...v, last_maintenance_at }))}
          />

          <Field
            label={strings.mototaxis.notes}
            value={values.notes}
            onChange={(notes) => setValues((v) => ({ ...v, notes }))}
          />

          {save.error != null && !confirmingDetach && (
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
              disabled={save.isPending}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {save.isPending ? strings.common.loading : strings.common.save}
            </button>
          </div>
        </form>
      </FormDialog>

      <ConfirmDialog
        open={confirmingDetach}
        title={strings.fleet.detachTrackerTitle}
        body={strings.fleet.detachTrackerBody(initial.tracker_imei, values.plate_number)}
        confirmLabel={strings.fleet.detachTrackerConfirm}
        pending={save.isPending}
        error={save.error}
        onConfirm={() => save.mutate()}
        onClose={() => setConfirmingDetach(false)}
      />
    </>
  );
}
