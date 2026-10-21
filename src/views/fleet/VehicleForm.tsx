import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';

import { createVehicle, listVehicleTypes, updateVehicle } from '@/api/admin';
import { queryKeys } from '@/api/queries';
import type { TrackerType, Vehicle } from '@/api/types';
import { AttributeSchemaForm } from '@/components/AttributeSchemaForm';
import { attributeErrors, toAttributes, toDraft, type AttributeDraft } from '@/lib/attributes';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Field, FormDialog, SelectField } from '@/components/Field';
import { hasChanges, vehicleChanges, parseCredit, type VehicleFormValues } from '@/lib/dirty';
import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';

function toValues(unit: Vehicle): VehicleFormValues {
  return {
    plate_number: unit.plate_number,
    alias: unit.alias ?? '',
    brand: unit.brand ?? '',
    model: unit.model ?? '',
    device_id: unit.device_id ?? '',
    tracker_type: unit.tracker_type,
    vehicle_type_uuid: unit.vehicle_type_uuid ?? '',
    attributes: unit.attributes,
    sim_last_recharge_at: unit.sim_last_recharge_at ?? '',
    sim_last_recharge_amount:
      unit.sim_last_recharge_amount === null ? '' : String(unit.sim_last_recharge_amount),
    notes: unit.notes ?? '',
    last_maintenance_at: unit.last_maintenance_at ?? '',
  };
}

const emptyValues: VehicleFormValues = {
  plate_number: '',
  alias: '',
  brand: '',
  model: '',
  device_id: '',
  tracker_type: 'GT06',
  vehicle_type_uuid: '',
  attributes: {},
  sim_last_recharge_at: '',
  sim_last_recharge_amount: '',
  notes: '',
  last_maintenance_at: '',
};

/** The date and the credit go together; one without the other cannot give a next date. */
function simErrors(values: VehicleFormValues): Record<string, string> {
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

export function VehicleForm({
  vehicle,
  onClose,
}: {
  vehicle: Vehicle | null;
  onClose: () => void;
}) {
  const editing = vehicle !== null;
  const initial = vehicle ? toValues(vehicle) : emptyValues;
  const queryClient = useQueryClient();

  const [values, setValues] = useState<VehicleFormValues>(initial);
  const [draft, setDraft] = useState<AttributeDraft>({});
  const [draftType, setDraftType] = useState<string | null>(null);

  const types = useQuery({ queryKey: queryKeys.vehicleTypes, queryFn: () => listVehicleTypes() });
  const selectedType = types.data?.find((t) => t.vehicle_type_uuid === values.vehicle_type_uuid);
  const schema = useMemo(() => selectedType?.attribute_schema ?? [], [selectedType]);
  // Seed the inputs from the stored values once the schema is known, and again
  // whenever the operator picks another type.
  if (selectedType && draftType !== selectedType.vehicle_type_uuid) {
    setDraftType(selectedType.vehicle_type_uuid);
    setDraft(
      toDraft(
        selectedType.attribute_schema,
        selectedType.vehicle_type_uuid === initial.vehicle_type_uuid ? initial.attributes : {},
      ),
    );
  }
  // Another type's values are not carried over; the same type keeps unknown stored keys.
  const attributes = toAttributes(
    schema,
    draft,
    values.vehicle_type_uuid === initial.vehicle_type_uuid ? initial.attributes : {},
  );
  const current: VehicleFormValues = { ...values, attributes };
  const [validation, setValidation] = useState<Partial<Record<string, string>>>({});
  const [attributeProblems, setAttributeProblems] = useState<Record<string, string>>({});
  const [confirmingDetach, setConfirmingDetach] = useState(false);

  const { payload, detachesTracker } = vehicleChanges(initial, current);
  const hasTracker = values.device_id.trim() !== '';

  const save = useMutation({
    mutationFn: async () => {
      if (editing) return updateVehicle(vehicle.vehicle_uuid, payload);
      return createVehicle({
        plate_number: values.plate_number.trim(),
        alias: values.alias.trim() || null,
        brand: values.brand.trim() || null,
        model: values.model.trim() || null,
        device_id: values.device_id.trim() || null,
        tracker_type: values.tracker_type,
        vehicle_type_uuid: values.vehicle_type_uuid || null,
        attributes,
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
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      void queryClient.invalidateQueries({ queryKey: ['vehicle'] });
      setConfirmingDetach(false);
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!values.plate_number.trim()) errors.plate = strings.fleet.requiredField;
    if (hasTracker) Object.assign(errors, simErrors(values));
    const attrErrors = attributeErrors(schema, draft);
    setAttributeProblems(attrErrors);
    setValidation(errors);
    if (Object.keys(errors).length + Object.keys(attrErrors).length > 0) return;
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
        title={editing ? strings.fleet.editVehicle : strings.fleet.newVehicle}
        onClose={onClose}
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Field
            label={strings.vehicles.plate}
            value={values.plate_number}
            onChange={(plate_number) => setValues((v) => ({ ...v, plate_number }))}
            required
            error={validation.plate}
          />

          <Field
            label={strings.vehicles.alias}
            value={values.alias}
            onChange={(alias) => setValues((v) => ({ ...v, alias }))}
            hint={strings.fleet.aliasHint}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={strings.vehicles.brand}
              value={values.brand}
              onChange={(brand) => setValues((v) => ({ ...v, brand }))}
            />
            <Field
              label={strings.vehicles.model}
              value={values.model}
              onChange={(model) => setValues((v) => ({ ...v, model }))}
            />
          </div>

          <SelectField
            label={strings.fleet.vehicleType}
            value={values.vehicle_type_uuid}
            onChange={(vehicle_type_uuid) => setValues((v) => ({ ...v, vehicle_type_uuid }))}
            options={[
              { value: '', label: strings.fleet.noVehicleType },
              ...(types.data ?? [])
                // A type switched off stays selectable on the vehicle that still uses it.
                .filter((t) => t.is_active || t.vehicle_type_uuid === initial.vehicle_type_uuid)
                .map((t) => ({ value: t.vehicle_type_uuid, label: t.display_name })),
            ]}
          />

          <AttributeSchemaForm
            schema={schema}
            draft={draft}
            errors={attributeProblems}
            onChange={(key, value) => setDraft((d) => ({ ...d, [key]: value }))}
          />

          <Field
            label={
              values.tracker_type === 'GT06' ? strings.vehicles.imei : strings.vehicles.deviceId
            }
            value={values.device_id}
            onChange={(device_id) => setValues((v) => ({ ...v, device_id }))}
            hint={strings.fleet.imeiHint}
          />

          {hasTracker && (
            <SelectField
              label={strings.fleet.trackerType}
              value={values.tracker_type}
              onChange={(tracker_type) =>
                setValues((v) => ({ ...v, tracker_type: tracker_type as TrackerType }))
              }
              options={[
                { value: 'GT06', label: 'GT06' },
                { value: 'SECUREMORE', label: 'SECUREMORE' },
              ]}
              hint={strings.fleet.trackerTypeHint}
            />
          )}

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
            label={strings.vehicles.lastMaintenance}
            type="date"
            value={values.last_maintenance_at}
            onChange={(last_maintenance_at) => setValues((v) => ({ ...v, last_maintenance_at }))}
          />

          <Field
            label={strings.vehicles.notes}
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
        body={strings.fleet.detachTrackerBody(initial.device_id, values.plate_number)}
        confirmLabel={strings.fleet.detachTrackerConfirm}
        pending={save.isPending}
        error={save.error}
        onConfirm={() => save.mutate()}
        onClose={() => setConfirmingDetach(false)}
      />
    </>
  );
}
