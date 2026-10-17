import { useQuery } from '@tanstack/react-query';

import { getDriverPositionCheck } from '@/api/admin';
import { queryKeys } from '@/api/queries';
import type { Driver, PositionFix } from '@/api/types';
import { ErrorState } from '@/components/ErrorState';
import { FormDialog } from '@/components/Field';
import { ToneBadge } from '@/components/StatusBadge';
import { EMPTY, formatCoords, formatMeters, formatRelative } from '@/lib/format';
import { strings } from '@/lib/strings';

const RECENT_FIXES = 8;

/**
 * The driver's own trace set beside their unit's.
 *
 * Phone and WhatsApp positions are the driver's; the GPS tracker is the
 * unit's. Keeping the two apart is what makes a gap between them visible: a
 * driver away from the moto, a failing tracker, or a faked phone.
 */
export function PositionCheckDialog({ driver, onClose }: { driver: Driver; onClose: () => void }) {
  const check = useQuery({
    queryKey: queryKeys.positionCheck(driver.driver_uuid),
    queryFn: () => getDriverPositionCheck(driver.driver_uuid),
  });

  return (
    <FormDialog title={strings.drivers.positionCheckTitle(driver.name)} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{strings.drivers.positionCheckIntro}</p>

        {check.isPending && <div className="h-40 animate-pulse rounded-lg bg-slate-100" />}
        {check.isError && <ErrorState error={check.error} onRetry={() => void check.refetch()} />}

        {check.data && (
          <>
            {check.data.mototaxi_uuid === null && (
              <p className="text-sm text-slate-600">{strings.drivers.positionCheckNoMototaxi}</p>
            )}

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <Row label={strings.drivers.positionCheckDriver} fix={check.data.driver_fix} />
              <Row label={strings.drivers.positionCheckVehicle} fix={check.data.vehicle_fix} />
              <Row label={strings.drivers.positionCheckTracker} fix={check.data.tracker_fix} />
              <dt className="text-slate-600">{strings.drivers.positionCheckDriverToVehicle}</dt>
              <dd className="font-medium text-slate-900">
                {formatMeters(check.data.driver_to_vehicle_m)}
              </dd>
              <dt className="text-slate-600">{strings.drivers.positionCheckDriverToTracker}</dt>
              <dd className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                {formatMeters(check.data.driver_to_tracker_m)}
                {check.data.seconds_apart !== null && (
                  <span className="text-xs font-normal text-slate-500">
                    {strings.drivers.positionCheckSecondsApart(check.data.seconds_apart)}
                  </span>
                )}
                {check.data.driver_to_tracker_m !== null && (
                  <ToneBadge
                    tone={check.data.diverges ? 'warn' : 'good'}
                    title={
                      check.data.diverges ? strings.drivers.positionCheckDivergesHint : undefined
                    }
                  >
                    {check.data.diverges
                      ? strings.drivers.positionCheckDiverges
                      : strings.drivers.positionCheckAgrees}
                  </ToneBadge>
                )}
              </dd>
              <dt className="text-slate-600">{strings.drivers.positionCheckFlagged}</dt>
              <dd className="font-medium text-slate-900">
                {check.data.flagged_fixes > 0 ? (
                  <ToneBadge tone="warn">{String(check.data.flagged_fixes)}</ToneBadge>
                ) : (
                  check.data.flagged_fixes
                )}
              </dd>
            </dl>

            <div>
              <h3 className="mb-1 text-xs font-medium text-slate-600">
                {strings.drivers.positionCheckRecent}
              </h3>
              {check.data.driver_trace.length === 0 ? (
                <p className="text-sm text-slate-500">{strings.drivers.positionCheckNoFixes}</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="py-1 pr-2 font-medium">{strings.drivers.positionCheckWhen}</th>
                      <th className="py-1 pr-2 font-medium">
                        {strings.drivers.positionCheckSource}
                      </th>
                      <th className="py-1 font-medium">{strings.drivers.positionCheckFlagLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {check.data.driver_trace.slice(0, RECENT_FIXES).map((fix) => (
                      <tr key={`${fix.recorded_at}-${fix.source}`} className="border-t">
                        <td className="py-1 pr-2">{formatRelative(fix.recorded_at)}</td>
                        <td className="py-1 pr-2">
                          {strings.drivers.sources[fix.source] ?? fix.source}
                        </td>
                        <td className="py-1">
                          {fix.flag ? (
                            <ToneBadge tone="warn">
                              {strings.drivers.flags[fix.flag] ?? fix.flag}
                            </ToneBadge>
                          ) : (
                            EMPTY
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {strings.common.close}
          </button>
        </div>
      </div>
    </FormDialog>
  );
}

function Row({ label, fix }: { label: string; fix: PositionFix | null }) {
  return (
    <>
      <dt className="text-slate-600">{label}</dt>
      <dd className="text-slate-900">
        {fix ? (
          <>
            <span className="font-medium">{strings.drivers.sources[fix.source] ?? fix.source}</span>
            <span className="text-slate-500">
              {' · '}
              {formatRelative(fix.recorded_at)}
              {' · '}
              {formatCoords(fix.lat, fix.lon)}
            </span>
          </>
        ) : (
          <span className="text-slate-500">{strings.drivers.positionCheckNone}</span>
        )}
      </dd>
    </>
  );
}
