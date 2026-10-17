import { useState } from 'react';

import type { RevealGroup } from '@/components/revealGroup';
import { strings } from '@/lib/strings';

/** The «Mostrar todo» / «Ocultar todo» button for a column header. */
export function RevealAllButton({ group, label }: { group: RevealGroup; label: string }) {
  const action = group.revealed ? strings.common.hideAll : strings.common.revealAll;
  return (
    <button
      type="button"
      onClick={group.toggle}
      aria-label={`${action}: ${label}`}
      className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] font-medium tracking-normal text-slate-600 normal-case hover:bg-slate-100 hover:text-slate-900"
    >
      {action}
    </button>
  );
}

/**
 * Shows a masked value with a per-row reveal (spec §12.1: no bulk raw phone
 * lists on screen). Revealing is deliberate; the optional `group` lets the
 * column header reveal or hide every row at once, and rows that appear later
 * (search, filters) start in the group's current state. The CSV export is the
 * other sanctioned way to get full values.
 */
export function MaskedValue({
  value,
  masked,
  group,
}: {
  value: string;
  masked: string;
  group?: RevealGroup;
}) {
  const [state, setState] = useState({
    revealed: group?.revealed ?? false,
    nonce: group?.nonce ?? 0,
  });
  // A column-wide press overrides whatever this row was set to by hand. Adjusting
  // state while rendering is React's sanctioned way to derive it from a prop.
  if (group && state.nonce !== group.nonce) {
    setState({ revealed: group.revealed, nonce: group.nonce });
  }
  const { revealed } = state;

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span className="tabular-nums">{revealed ? value : masked}</span>
      <button
        type="button"
        onClick={() => setState((current) => ({ ...current, revealed: !current.revealed }))}
        aria-label={`${revealed ? strings.common.hide : strings.common.reveal}: ${masked}`}
        className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-700"
      >
        {revealed ? strings.common.hide : strings.common.reveal}
      </button>
    </span>
  );
}
