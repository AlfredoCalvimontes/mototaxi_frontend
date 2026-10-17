import { useCallback, useMemo, useState } from 'react';

/**
 * One reveal switch for a whole column. Each press bumps `nonce`, which is how
 * every {@link MaskedValue} in the group learns that it should follow `revealed`
 * again even if it was toggled by hand in between.
 */
export type RevealGroup = { revealed: boolean; nonce: number; toggle: () => void };

export function useRevealGroup(): RevealGroup {
  const [state, setState] = useState({ revealed: false, nonce: 0 });
  const toggle = useCallback(
    () => setState((current) => ({ revealed: !current.revealed, nonce: current.nonce + 1 })),
    [],
  );
  // Memoised so a column definition that closes over it stays stable.
  return useMemo(
    () => ({ revealed: state.revealed, nonce: state.nonce, toggle }),
    [state.revealed, state.nonce, toggle],
  );
}
