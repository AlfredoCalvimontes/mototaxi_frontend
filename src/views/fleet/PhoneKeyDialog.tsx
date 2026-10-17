import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { issueDriverPhoneKey, revokeDriverPhoneKey } from '@/api/admin';
import type { Driver } from '@/api/types';
import { FormDialog } from '@/components/Field';
import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';

/** Where Traccar Client reports to. Same origin as this app: Caddy serves both. */
const SERVER_URL = `${window.location.origin}/api/v1/tracking/phone`;

/**
 * Issues, rotates or revokes the key a driver's phone reports GPS with.
 *
 * The key belongs to the driver, not to a unit, so it keeps working when they
 * are moved to another one.
 *
 * The server stores only a hash, so the key exists in the clear exactly once —
 * in the response to issuing it. It is held in this component's state and
 * nowhere else (not the query cache, not storage): closing the dialog is the
 * point of no return.
 */
export function PhoneKeyDialog({
  driver,
  mototaxiLabel,
  onClose,
}: {
  driver: Driver;
  /** The unit the driver is on, for display; `null` when none is assigned. */
  mototaxiLabel: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [key, setKey] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(driver.has_phone_key);
  const [copied, setCopied] = useState<'key' | 'url' | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['drivers'] });
    void queryClient.invalidateQueries({ queryKey: ['driver'] });
  }

  const issue = useMutation({
    mutationFn: () => issueDriverPhoneKey(driver.driver_uuid),
    onSuccess: (response) => {
      setKey(response.phone_key);
      setHasKey(true);
      refresh();
    },
  });

  const revoke = useMutation({
    mutationFn: () => revokeDriverPhoneKey(driver.driver_uuid),
    onSuccess: () => {
      setKey(null);
      setHasKey(false);
      refresh();
    },
  });

  async function copy(what: 'key' | 'url', text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      // Clipboard access can be refused (insecure context, permissions). The
      // value is on screen and selectable, so copying by hand still works.
      setCopied(null);
    }
  }

  const error = issue.error ?? revoke.error;
  const busy = issue.isPending || revoke.isPending;

  return (
    <FormDialog title={strings.fleet.phoneKeyTitle(driver.name)} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{strings.fleet.phoneKeyIntro}</p>
        <p className="text-sm text-slate-600">
          {strings.fleet.currentMototaxi}:{' '}
          <span className="font-medium text-slate-900">
            {mototaxiLabel ?? strings.fleet.noMototaxi}
          </span>
        </p>
        {mototaxiLabel === null && (
          <p className="text-xs text-slate-500">{strings.fleet.phoneKeyNoMototaxi}</p>
        )}

        {key !== null ? (
          <div className="space-y-3">
            <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {strings.fleet.phoneKeyShownOnce}
            </p>
            <div>
              <div className="mb-1 text-xs font-medium text-slate-600">
                {strings.fleet.phoneKey}
              </div>
              <div className="flex items-start gap-2">
                <code
                  data-testid="phone-key"
                  className="block flex-1 rounded bg-slate-100 px-3 py-2 text-sm break-all select-all"
                >
                  {key}
                </code>
                <button
                  type="button"
                  onClick={() => void copy('key', key)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50"
                >
                  {copied === 'key' ? strings.fleet.phoneKeyCopied : strings.fleet.phoneKeyCopy}
                </button>
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-slate-600">
                {strings.fleet.phoneKeyServerUrl}
              </div>
              <div className="flex items-start gap-2">
                <code className="block flex-1 rounded bg-slate-100 px-3 py-2 text-xs break-all select-all">
                  {SERVER_URL}
                </code>
                <button
                  type="button"
                  onClick={() => void copy('url', SERVER_URL)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50"
                >
                  {copied === 'url' ? strings.fleet.phoneKeyCopied : strings.fleet.phoneKeyCopy}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p
            className={`rounded border px-3 py-2 text-sm font-medium ${
              hasKey
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                : 'border-slate-200 bg-slate-50 text-slate-800'
            }`}
          >
            {hasKey && (
              <span aria-hidden="true" className="mr-1.5 font-bold text-emerald-600">
                ✓
              </span>
            )}
            {hasKey ? strings.fleet.phoneKeyIssued : strings.fleet.phoneKeyNone}
          </p>
        )}

        {key === null && hasKey && (
          <p className="text-xs text-slate-500">{strings.fleet.phoneKeyRotateWarning}</p>
        )}

        {error != null && (
          <p
            role="alert"
            className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {errorText(error)}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {key === null && hasKey && (
            <button
              type="button"
              disabled={busy}
              onClick={() => revoke.mutate()}
              title={strings.fleet.phoneKeyRevokeHint}
              className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              {strings.fleet.phoneKeyRevoke}
            </button>
          )}
          {key === null ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => issue.mutate()}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {issue.isPending
                ? strings.common.loading
                : hasKey
                  ? strings.fleet.phoneKeyRotate
                  : strings.fleet.phoneKeyGenerate}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              {strings.fleet.phoneKeyDone}
            </button>
          )}
        </div>
      </div>
    </FormDialog>
  );
}
