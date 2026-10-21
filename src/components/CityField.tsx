import { SelectField } from '@/components/Field';
import { strings } from '@/lib/strings';
import { useCities } from '@/lib/useCities';

/**
 * City picker for a registration form. Renders nothing when the caller has no
 * cities to choose from (an operator, or a tenant with none yet), so the form
 * stays as it was. Existing records change city through the move dialogs, never
 * through the edit forms.
 */
export function CityField({
  value,
  onChange,
}: {
  value: string;
  onChange: (cityUuid: string) => void;
}) {
  const { cities } = useCities();
  const active = cities.filter((c) => c.is_active);
  if (active.length === 0) return null;
  return (
    <SelectField
      label={strings.tenancy.cityFieldLabel}
      value={value}
      onChange={onChange}
      options={[
        { value: '', label: strings.tenancy.noCity },
        ...active.map((c) => ({ value: c.city_id, label: c.name })),
      ]}
    />
  );
}
