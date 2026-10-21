import type { AttributeSchemaField } from '@/api/types';
import { strings } from '@/lib/strings';

export type AttributeValues = Record<string, unknown>;

/** Text kept in the inputs; converted to typed values by {@link toAttributes}. */
export type AttributeDraft = Record<string, string>;

/** The draft a form starts from: stored values rendered as the text inputs show them. */
export function toDraft(schema: AttributeSchemaField[], values: AttributeValues): AttributeDraft {
  const draft: AttributeDraft = {};
  for (const field of schema) {
    const value = values[field.key];
    draft[field.key] = value === undefined || value === null ? '' : String(value);
  }
  return draft;
}

function parseNumber(text: string, integer: boolean): number | null {
  const n = Number(text.trim().replace(',', '.'));
  if (!Number.isFinite(n) || (integer && !Number.isInteger(n))) return null;
  return n;
}

/**
 * Turns the draft into the typed object the API validates. Keys the schema does
 * not describe are kept from `existing`: the server replaces the whole object
 * on update, so dropping them here would silently erase stored data.
 */
export function toAttributes(
  schema: AttributeSchemaField[],
  draft: AttributeDraft,
  existing: AttributeValues = {},
): AttributeValues {
  const known = new Set(schema.map((f) => f.key));
  const result: AttributeValues = {};
  for (const [key, value] of Object.entries(existing)) {
    if (!known.has(key)) result[key] = value;
  }
  for (const field of schema) {
    const text = (draft[field.key] ?? '').trim();
    if (text === '') continue;
    if (field.type === 'bool') result[field.key] = text === 'true';
    else if (field.type === 'string') result[field.key] = text;
    else result[field.key] = parseNumber(text, field.type === 'int');
  }
  return result;
}

/** Field-level problems the form can catch before the server does. */
export function attributeErrors(
  schema: AttributeSchemaField[],
  draft: AttributeDraft,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of schema) {
    const text = (draft[field.key] ?? '').trim();
    if (text === '') {
      if (field.required) errors[field.key] = strings.fleet.attributeRequired;
    } else if (
      (field.type === 'int' || field.type === 'float') &&
      parseNumber(text, field.type === 'int') === null
    ) {
      errors[field.key] = strings.fleet.attributeInvalidNumber;
    }
  }
  return errors;
}
