import { useId, useState, type ReactNode } from 'react';

import { strings } from '@/lib/strings';

const control =
  'mt-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-slate-500 focus:outline-none';

/** The row of filters above a list: one look for every view. */
export function FilterBar({
  children,
  active,
  onClear,
  summary,
}: {
  children: ReactNode;
  /** Something is filtered, so «Limpiar filtros» is useful. */
  active: boolean;
  onClear: () => void;
  /** «3 de 12 resultados». */
  summary?: string;
}) {
  return (
    <section
      aria-label={strings.filters.heading}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3"
    >
      {children}
      <div className="ml-auto flex items-center gap-3 text-sm">
        {summary && <span className="text-slate-500">{summary}</span>}
        {active && (
          <button
            type="button"
            onClick={onClear}
            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {strings.filters.clear}
          </button>
        )}
      </div>
    </section>
  );
}

export type FilterOption = { value: string; label: string };

export function SelectFilter({
  label,
  value,
  onChange,
  options,
  allLabel = strings.filters.all,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly FilterOption[];
  allLabel?: string;
}) {
  return (
    <label className="text-sm">
      <span className="block text-slate-600">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={control}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextFilter({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="text-sm">
      <span className="block text-slate-600">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${control} w-48`}
      />
    </label>
  );
}

export function CheckFilter({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 pb-1 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-slate-300"
      />
      {label}
    </label>
  );
}

/** Start and end as date + time («Desde» / «Hasta»), both optional unless the view needs them. */
export function DateTimeRange({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  return (
    <>
      <label className="text-sm">
        <span className="block text-slate-600">{strings.filters.from}</span>
        <input
          type="datetime-local"
          value={from}
          max={to || undefined}
          onChange={(e) => onFrom(e.target.value)}
          aria-label={strings.filters.fromHint}
          className={control}
        />
      </label>
      <label className="text-sm">
        <span className="block text-slate-600">{strings.filters.to}</span>
        <input
          type="datetime-local"
          value={to}
          min={from || undefined}
          onChange={(e) => onTo(e.target.value)}
          aria-label={strings.filters.toHint}
          className={control}
        />
      </label>
    </>
  );
}

/** Accent- and case-insensitive match, so «jose» finds «José». */
function foldText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * A select you can type into: for long lists (drivers, vehicles) where
 * scrolling a native dropdown is slow. Picking «Todos» (the empty value) clears it.
 */
export function SearchSelectFilter({
  label,
  value,
  onChange,
  options,
  allLabel = strings.filters.all,
  placeholder = strings.filters.searchPlaceholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly FilterOption[];
  allLabel?: string;
  placeholder?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.value === value);

  const needle = foldText(query.trim());
  const visible = [{ value: '', label: allLabel }, ...options].filter(
    (option) => !needle || foldText(option.label).includes(needle),
  );

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="relative text-sm">
      <label htmlFor={id} className="block text-slate-600">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-1">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          autoComplete="off"
          value={open ? query : (selected?.label ?? allLabel)}
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          onChange={(e) => {
            setOpen(true);
            setQuery(e.target.value);
          }}
          onBlur={() => {
            setOpen(false);
            setQuery('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter' && visible.length > 0) {
              e.preventDefault();
              pick(visible[0]!.value);
            }
          }}
          className={`${control} mt-0 w-52`}
        />
        {value && (
          <button
            type="button"
            aria-label={strings.filters.clear}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick('')}
            className="rounded px-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            ×
          </button>
        )}
      </div>
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-64 overflow-y-auto rounded border border-slate-200 bg-white py-1 shadow-lg"
        >
          {visible.length === 0 && (
            <li className="px-3 py-2 text-slate-500">{strings.filters.noMatches}</li>
          )}
          {visible.map((option) => (
            <li key={option.value || '__all'} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                // mousedown fires before the input's blur, so the pick lands.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(option.value)}
                className={`block w-full px-3 py-1.5 text-left hover:bg-slate-100 ${
                  option.value === value ? 'font-medium text-slate-900' : 'text-slate-700'
                }`}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
