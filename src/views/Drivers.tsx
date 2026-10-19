import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

import { deleteDriver, listDrivers, listMototaxis } from '@/api/admin';
import { POLL, queryKeys } from '@/api/queries';
import type { Driver, MototaxiSummary } from '@/api/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { MaskedValue, RevealAllButton } from '@/components/MaskedValue';
import { useRevealGroup } from '@/components/revealGroup';
import { StatusBadge, ToneBadge, WarningBadge } from '@/components/StatusBadge';
import { TableSkeleton } from '@/components/Skeleton';
import { AssignMototaxiDialog } from '@/views/fleet/AssignMototaxiDialog';
import { DriverForm } from '@/views/fleet/DriverForm';
import { DriverStatusDialog } from '@/views/fleet/DriverStatusDialog';
import { PhoneKeyDialog } from '@/views/fleet/PhoneKeyDialog';
import { PositionCheckDialog } from '@/views/fleet/PositionCheckDialog';
import { UsageCreditDialog } from '@/views/fleet/UsageCreditDialog';
import {
  EMPTY,
  formatDate,
  formatDateTime,
  formatDuration,
  formatPercent,
  formatRelative,
  maskCi,
  maskPhone,
  vehicleLabel,
} from '@/lib/format';
import { strings } from '@/lib/strings';
import { trackingState, type TrackingState } from '@/lib/tracking';
import { formatCredit, usageCreditState } from '@/lib/usageCredit';

/** Set by the dashboard's "sin check-in" alert. */
const CHECKIN_PARAM = 'checkin';
const CHECKIN_PENDING = 'pendiente';

/** Which dialog is open, and for whom. `null` driver means "register new". */
type DriverDialog =
  | { kind: 'form'; driver: Driver | null }
  | { kind: 'status'; driver: Driver }
  | { kind: 'assign'; driver: Driver }
  | { kind: 'phoneKey'; driver: Driver }
  | { kind: 'position'; driver: Driver }
  | { kind: 'credit'; driver: Driver }
  | { kind: 'retire'; driver: Driver };

const TRACKING_BADGES: Record<
  TrackingState,
  { tone: 'good' | 'warn' | 'idle'; label: string; hint: string }
> = {
  noMototaxi: {
    tone: 'idle',
    label: strings.drivers.trackingNoMototaxi,
    hint: strings.drivers.trackingNoMototaxiHint,
  },
  tracker: {
    tone: 'good',
    label: strings.drivers.trackingTracker,
    hint: strings.drivers.trackingTrackerHint,
  },
  trackerStale: {
    tone: 'warn',
    label: strings.drivers.trackingTrackerStale,
    hint: strings.drivers.trackingTrackerStaleHint,
  },
  phone: {
    tone: 'good',
    label: strings.drivers.trackingPhone,
    hint: strings.drivers.trackingPhoneHint,
  },
  shared: {
    tone: 'good',
    label: strings.drivers.trackingShared,
    hint: strings.drivers.trackingSharedHint,
  },
  needsShare: {
    tone: 'warn',
    label: strings.drivers.trackingNeedsShare,
    hint: strings.drivers.trackingNeedsShareHint,
  },
};

/** The expiry date, red once the credit has run out and amber in its last days. */
function CreditExpiry({ driver }: { driver: Driver }) {
  const { state, daysLeft } = usageCreditState(driver);
  if (state === 'off' || !driver.usage_credit_expires_on) return null;
  const text = {
    ok: '',
    soon: 'font-medium text-amber-700',
    expired: 'font-semibold text-red-700',
  }[state];
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className={`tabular-nums ${text}`}>{formatDate(driver.usage_credit_expires_on)}</span>
      {state === 'expired' && (
        <ToneBadge tone="bad" title={strings.drivers.creditExpiredHint}>
          {strings.drivers.creditExpiredBadge}
        </ToneBadge>
      )}
      {state === 'soon' && daysLeft !== null && (
        <ToneBadge tone="warn">{strings.drivers.creditSoonBadge(daysLeft)}</ToneBadge>
      )}
    </div>
  );
}

export default function Drivers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const onlyWithoutCheckin = searchParams.get(CHECKIN_PARAM) === CHECKIN_PENDING;
  const [dialog, setDialog] = useState<DriverDialog | null>(null);
  const queryClient = useQueryClient();
  const phoneGroup = useRevealGroup();
  const ciGroup = useRevealGroup();

  const retire = useMutation({
    mutationFn: ({ driver, reason }: { driver: Driver; reason?: string }) =>
      deleteDriver(driver.driver_uuid, reason),
    onSuccess: () => {
      setDialog(null);
      void queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });

  const drivers = useQuery({
    queryKey: queryKeys.drivers(),
    queryFn: () => listDrivers(),
    refetchInterval: POLL.drivers,
  });

  const mototaxis = useQuery({
    queryKey: queryKeys.mototaxis,
    queryFn: listMototaxis,
    refetchInterval: POLL.mototaxis,
  });

  const units = useMemo(() => {
    const map = new Map<string, MototaxiSummary>();
    for (const unit of mototaxis.data ?? []) map.set(unit.mototaxi_uuid, unit);
    return map;
  }, [mototaxis.data]);

  const plates = useMemo(() => {
    const map = new Map<string, string>();
    for (const [uuid, unit] of units) map.set(uuid, vehicleLabel(unit));
    return map;
  }, [units]);

  const unitOf = useCallback(
    (driver: Driver) =>
      driver.current_mototaxi_uuid ? units.get(driver.current_mototaxi_uuid) : undefined,
    [units],
  );

  const rows = useMemo(() => {
    const all = drivers.data ?? [];
    return onlyWithoutCheckin ? all.filter((driver) => !driver.has_checked_in_today) : all;
  }, [drivers.data, onlyWithoutCheckin]);

  const columns: Column<Driver>[] = useMemo(
    () => [
      {
        id: 'name',
        header: strings.drivers.name,
        sortValue: (driver) => driver.name,
        cell: (driver) => <span className="font-medium text-slate-900">{driver.name}</span>,
      },
      {
        id: 'status',
        header: strings.drivers.status,
        sortValue: (driver) => driver.status,
        cell: (driver) => (
          <div className="flex flex-wrap items-center gap-1">
            <StatusBadge
              kind="driver"
              value={driver.status}
              title={
                driver.status === 'RESTING' && driver.resting_until
                  ? `${strings.drivers.restingUntil} ${formatDateTime(driver.resting_until)}`
                  : undefined
              }
            />
            {!driver.has_checked_in_today && (
              <WarningBadge title={strings.drivers.noCheckinHint}>
                {strings.drivers.noCheckinBadge}
              </WarningBadge>
            )}
          </div>
        ),
      },
      {
        id: 'mototaxi',
        header: strings.drivers.mototaxi,
        sortValue: (driver) =>
          driver.current_mototaxi_uuid ? (plates.get(driver.current_mototaxi_uuid) ?? '') : null,
        cell: (driver) =>
          driver.current_mototaxi_uuid ? (
            (plates.get(driver.current_mototaxi_uuid) ?? EMPTY)
          ) : (
            <WarningBadge title={strings.drivers.noMototaxiHint}>
              {strings.drivers.noMototaxiBadge}
            </WarningBadge>
          ),
      },
      {
        id: 'tracking',
        header: strings.drivers.tracking,
        sortValue: (driver) => trackingState(unitOf(driver)),
        cell: (driver) => {
          const unit = unitOf(driver);
          const badge = TRACKING_BADGES[trackingState(unit)];
          return (
            <div className="flex flex-col items-start gap-0.5">
              <ToneBadge tone={badge.tone} title={badge.hint}>
                {badge.label}
              </ToneBadge>
              {unit?.location_updated_at && (
                <span className="text-xs text-slate-500">
                  {formatRelative(unit.location_updated_at)}
                </span>
              )}
              {driver.has_phone_key && !unit && (
                <ToneBadge tone="warn" title={strings.fleet.phoneKeyNoMototaxi}>
                  {strings.drivers.phoneKeyNoMototaxiBadge}
                </ToneBadge>
              )}
            </div>
          );
        },
      },
      {
        id: 'phone',
        header: strings.drivers.phone,
        headerAction: <RevealAllButton group={phoneGroup} label={strings.drivers.phone} />,
        secondary: true,
        // Searchable by the full number even though only the mask is rendered.
        sortValue: (driver) => driver.phone_whatsapp,
        cell: (driver) => (
          <MaskedValue
            value={driver.phone_whatsapp}
            masked={maskPhone(driver.phone_whatsapp)}
            group={phoneGroup}
          />
        ),
      },
      {
        id: 'ci',
        header: strings.drivers.ci,
        headerAction: <RevealAllButton group={ciGroup} label={strings.drivers.ci} />,
        secondary: true,
        sortValue: (driver) => driver.ci,
        cell: (driver) => (
          <MaskedValue value={driver.ci} masked={maskCi(driver.ci)} group={ciGroup} />
        ),
      },
      {
        id: 'trips',
        header: strings.drivers.trips,
        align: 'right',
        sortValue: (driver) => driver.trips_completed,
        cell: (driver) => driver.trips_completed,
      },
      {
        id: 'acceptance',
        header: strings.drivers.acceptance,
        align: 'right',
        secondary: true,
        sortValue: (driver) => driver.acceptance_rate,
        cell: (driver) => formatPercent(driver.acceptance_rate),
      },
      {
        id: 'response',
        header: strings.drivers.responseTime,
        align: 'right',
        secondary: true,
        sortValue: (driver) => driver.average_response_seconds,
        cell: (driver) => formatDuration(driver.average_response_seconds),
      },
      {
        id: 'credit',
        header: strings.drivers.credit,
        align: 'right',
        sortValue: (driver) => driver.usage_credit_balance,
        // Empty — not a dash — off the scheme: it does not apply to this driver.
        cell: (driver) =>
          driver.usage_credit_enabled ? (
            <span
              className={`tabular-nums ${driver.usage_credit_expired ? 'font-semibold text-red-700' : ''}`}
            >
              {formatCredit(driver.usage_credit_balance)}
            </span>
          ) : (
            ''
          ),
      },
      {
        id: 'creditExpires',
        header: strings.drivers.creditExpires,
        sortValue: (driver) => driver.usage_credit_expires_on ?? null,
        cell: (driver) => <CreditExpiry driver={driver} />,
      },
      {
        id: 'checkin',
        header: strings.drivers.checkin,
        sortValue: (driver) => driver.last_checkin_at ?? null,
        cell: (driver) =>
          driver.last_checkin_at ? formatDateTime(driver.last_checkin_at) : strings.common.never,
      },
      {
        id: 'actions',
        header: '',
        cell: (driver) => (
          <div className="flex flex-wrap justify-end gap-1">
            <RowAction onClick={() => setDialog({ kind: 'form', driver })}>
              {strings.common.edit}
            </RowAction>
            <RowAction onClick={() => setDialog({ kind: 'status', driver })}>
              {strings.fleet.changeStatus}
              <StatusBadge kind="driver" value={driver.status} />
            </RowAction>
            <RowAction onClick={() => setDialog({ kind: 'assign', driver })}>
              {driver.current_mototaxi_uuid
                ? strings.fleet.changeMototaxi
                : strings.fleet.assignMototaxi}
            </RowAction>
            <RowAction
              active={driver.has_phone_key}
              onClick={() => setDialog({ kind: 'phoneKey', driver })}
            >
              {strings.fleet.phoneKey}
              <ToneBadge
                tone={driver.has_phone_key ? 'good' : 'idle'}
                title={driver.has_phone_key ? strings.drivers.phoneKeyBadge : undefined}
              >
                {driver.has_phone_key
                  ? strings.drivers.phoneKeyActive
                  : strings.drivers.phoneKeyMissing}
              </ToneBadge>
            </RowAction>
            <RowAction onClick={() => setDialog({ kind: 'position', driver })}>
              {strings.drivers.positionCheck}
            </RowAction>
            {driver.usage_credit_enabled && (
              <RowAction onClick={() => setDialog({ kind: 'credit', driver })}>
                {strings.drivers.addCredit}
              </RowAction>
            )}
            {driver.status !== 'DISABLED' && (
              <RowAction danger onClick={() => setDialog({ kind: 'retire', driver })}>
                {strings.fleet.retire}
              </RowAction>
            )}
          </div>
        ),
      },
    ],
    [plates, unitOf, phoneGroup, ciGroup],
  );

  if (drivers.isPending) return <TableSkeleton rows={5} />;
  if (drivers.isError) {
    return <ErrorState error={drivers.error} onRetry={() => void drivers.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{strings.drivers.heading}</h1>
        <button
          type="button"
          onClick={() => setDialog({ kind: 'form', driver: null })}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {strings.fleet.newDriver}
        </button>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlyWithoutCheckin}
            onChange={(e) =>
              setSearchParams(e.target.checked ? { [CHECKIN_PARAM]: CHECKIN_PENDING } : {}, {
                replace: true,
              })
            }
            className="rounded border-slate-300"
          />
          {strings.drivers.onlyWithoutCheckin}
        </label>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(driver) => driver.driver_uuid}
        caption={strings.drivers.heading}
        searchPlaceholder={strings.common.search}
        initialSort={{ columnId: 'name', direction: 'asc' }}
        rowClassName={(driver) =>
          driver.usage_credit_expired
            ? 'bg-red-50/70 hover:bg-red-50'
            : driver.has_checked_in_today
              ? 'hover:bg-slate-50'
              : 'bg-amber-50/60'
        }
      />

      {dialog?.kind === 'form' && (
        <DriverForm driver={dialog.driver} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'status' && (
        <DriverStatusDialog driver={dialog.driver} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'assign' && (
        <AssignMototaxiDialog driver={dialog.driver} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'phoneKey' && (
        <PhoneKeyDialog
          driver={dialog.driver}
          mototaxiLabel={
            dialog.driver.current_mototaxi_uuid
              ? (plates.get(dialog.driver.current_mototaxi_uuid) ?? null)
              : null
          }
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'credit' && (
        <UsageCreditDialog driver={dialog.driver} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'position' && (
        <PositionCheckDialog driver={dialog.driver} onClose={() => setDialog(null)} />
      )}

      <ConfirmDialog
        open={dialog?.kind === 'retire'}
        title={strings.fleet.retireTitle}
        body={dialog?.kind === 'retire' ? strings.fleet.retireBody(dialog.driver.name) : ''}
        confirmLabel={strings.fleet.retire}
        reasonLabel={strings.fleet.retireReason}
        pending={retire.isPending}
        error={retire.error}
        onConfirm={(reason) =>
          dialog?.kind === 'retire' && retire.mutate({ driver: dialog.driver, reason })
        }
        onClose={() => {
          retire.reset();
          setDialog(null);
        }}
      />
    </div>
  );
}

function RowAction({
  children,
  onClick,
  danger,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  /** Something is set up behind this action, so it reads as «on». */
  active?: boolean;
}) {
  const tone = danger
    ? 'border-red-300 text-red-700 hover:bg-red-50'
    : active
      ? 'border-emerald-400 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
      : 'border-slate-300 text-slate-700 hover:bg-slate-50';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium whitespace-nowrap ${tone}`}
    >
      {children}
    </button>
  );
}
