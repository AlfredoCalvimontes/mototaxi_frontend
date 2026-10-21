import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/ConfirmDialog';

/**
 * Activate/deactivate with a confirmation on the destructive direction only:
 * putting something back in service needs no second look.
 */
export function ActiveToggle({
  active,
  activateLabel,
  deactivateLabel,
  confirmTitle,
  confirmBody,
  toggle,
  onDone,
}: {
  active: boolean;
  activateLabel: string;
  deactivateLabel: string;
  confirmTitle: string;
  confirmBody: string;
  toggle: (nextActive: boolean) => Promise<unknown>;
  onDone: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const change = useMutation({
    mutationFn: () => toggle(!active),
    onSuccess: () => {
      setConfirming(false);
      onDone();
    },
  });

  return (
    <>
      <button
        type="button"
        disabled={change.isPending}
        onClick={() => (active ? setConfirming(true) : change.mutate())}
        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {active ? deactivateLabel : activateLabel}
      </button>
      <ConfirmDialog
        open={confirming}
        title={confirmTitle}
        body={confirmBody}
        confirmLabel={deactivateLabel}
        destructive
        pending={change.isPending}
        error={change.error}
        onConfirm={() => change.mutate()}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}
