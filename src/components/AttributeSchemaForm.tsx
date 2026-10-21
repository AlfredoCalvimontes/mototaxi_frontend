import type { AttributeSchemaField } from '@/api/types';
import { Field, SelectField } from '@/components/Field';
import type { AttributeDraft } from '@/lib/attributes';
import { strings } from '@/lib/strings';

/**
 * Renders a vehicle type's `attribute_schema` as inputs. The server is the
 * validator; the errors here only spare a round trip for the obvious cases.
 */
export function AttributeSchemaForm({
  schema,
  draft,
  onChange,
  errors = {},
}: {
  schema: AttributeSchemaField[];
  draft: AttributeDraft;
  onChange: (key: string, value: string) => void;
  errors?: Record<string, string>;
}) {
  if (schema.length === 0) return null;
  return (
    <fieldset className="space-y-3 rounded border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium text-slate-700">
        {strings.fleet.attributesSection}
      </legend>
      {schema.map((field) =>
        field.type === 'bool' ? (
          <SelectField
            key={field.key}
            label={field.label}
            required={field.required}
            value={draft[field.key] ?? ''}
            onChange={(value) => onChange(field.key, value)}
            options={[
              { value: '', label: '—' },
              { value: 'true', label: 'Sí' },
              { value: 'false', label: 'No' },
            ]}
          />
        ) : (
          <Field
            key={field.key}
            label={field.label}
            required={field.required}
            value={draft[field.key] ?? ''}
            onChange={(value) => onChange(field.key, value)}
            error={errors[field.key]}
          />
        ),
      )}
    </fieldset>
  );
}
