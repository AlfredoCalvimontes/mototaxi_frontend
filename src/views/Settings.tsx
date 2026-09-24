import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';

import { listSettings, updateSetting } from '@/api/admin';
import { queryKeys } from '@/api/queries';
import type { RuntimeSetting } from '@/api/types';
import { ErrorState } from '@/components/ErrorState';
import { InfoTip } from '@/components/InfoTip';
import { TableSkeleton } from '@/components/Skeleton';
import { errorText } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { strings } from '@/lib/strings';

/** Whole numbers only: "30.5" or "3e1" are typos, not intentions. */
function parseWhole(text: string): number | null {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
}

function SettingCard({ setting }: { setting: RuntimeSetting }) {
  const inputId = useId();
  const queryClient = useQueryClient();
  const copy = strings.settings.parameters[setting.key];
  const unit = strings.settings.units[setting.unit] ?? setting.unit;
  const [draft, setDraft] = useState(String(setting.value));
  const [saved, setSaved] = useState(false);

  const parsed = parseWhole(draft);
  const valid = parsed !== null && parsed >= setting.minimum && parsed <= setting.maximum;
  const changed = parsed !== setting.value;

  const save = useMutation({
    mutationFn: (value: number) => updateSetting(setting.key, value),
    onSuccess: (updated) => {
      setDraft(String(updated.value));
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });

  function submit(event: FormEvent, value: number | null) {
    event.preventDefault();
    if (value === null) return;
    setSaved(false);
    save.mutate(value);
  }

  return (
    <form
      onSubmit={(event) => submit(event, valid ? parsed : null)}
      noValidate
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex items-center gap-2">
        <label htmlFor={inputId} className="text-sm font-medium text-slate-900">
          {copy?.label ?? setting.key}
        </label>
        {copy && <InfoTip text={copy.tooltip} />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          inputMode="numeric"
          value={draft}
          aria-invalid={!valid}
          aria-describedby={`${inputId}-hint`}
          onChange={(event) => {
            setDraft(event.target.value);
            setSaved(false);
          }}
          className={`w-24 rounded border px-3 py-2 text-sm focus:outline-none ${
            valid ? 'border-slate-300 focus:border-slate-500' : 'border-red-400'
          }`}
        />
        <span className="text-sm text-slate-600">{unit}</span>
        <button
          type="submit"
          disabled={!valid || !changed || save.isPending}
          className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {strings.settings.save}
        </button>
        {setting.value !== setting.default && (
          <button
            type="button"
            disabled={save.isPending}
            onClick={(event) => submit(event, setting.default)}
            className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {strings.settings.restoreDefault(setting.default, unit)}
          </button>
        )}
      </div>

      <p id={`${inputId}-hint`} className="text-xs text-slate-500">
        {valid
          ? strings.settings.allowedRange(setting.minimum, setting.maximum, unit)
          : strings.settings.invalid(setting.minimum, setting.maximum)}{' '}
        {setting.updated_at
          ? `${strings.settings.changedAt}: ${formatDateTime(setting.updated_at)}.`
          : strings.settings.neverChanged}
      </p>

      {save.error != null && (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {errorText(save.error)}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-emerald-700">
          {strings.settings.saved}
        </p>
      )}
    </form>
  );
}

export default function Settings() {
  const settings = useQuery({ queryKey: queryKeys.settings, queryFn: listSettings });

  if (settings.isPending) return <TableSkeleton rows={2} />;
  if (settings.isError) {
    return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{strings.settings.heading}</h1>
      <p className="text-sm text-slate-600">{strings.settings.intro}</p>
      {settings.data.map((setting) => (
        <SettingCard key={`${setting.key}:${setting.value}`} setting={setting} />
      ))}
    </div>
  );
}
