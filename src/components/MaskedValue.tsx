import { useState } from 'react';

import { strings } from '@/lib/strings';

/**
 * Shows a masked value with a per-row reveal (spec §12.1: no bulk raw phone
 * lists on screen). Revealing is deliberate and one row at a time; the CSV
 * export is the other sanctioned way to get full values.
 */
export function MaskedValue({ value, masked }: { value: string; masked: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span className="tabular-nums">{revealed ? value : masked}</span>
      <button
        type="button"
        onClick={() => setRevealed((current) => !current)}
        aria-label={`${revealed ? strings.common.hide : strings.common.reveal}: ${masked}`}
        className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-700"
      >
        {revealed ? strings.common.hide : strings.common.reveal}
      </button>
    </span>
  );
}
