import type { DriverStatus, MototaxiStatus, TripStatus } from '@/api/types';
import { strings } from '@/lib/strings';

type Tone = 'good' | 'busy' | 'idle' | 'warn' | 'bad' | 'neutral';

const toneClasses: Record<Tone, string> = {
  good: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  busy: 'bg-blue-100 text-blue-800 ring-blue-200',
  idle: 'bg-slate-100 text-slate-700 ring-slate-200',
  warn: 'bg-amber-100 text-amber-900 ring-amber-200',
  bad: 'bg-red-100 text-red-800 ring-red-200',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
};

const driverTones: Record<DriverStatus, Tone> = {
  AVAILABLE: 'good',
  IN_TRIP: 'busy',
  RESTING: 'warn',
  OFFLINE: 'idle',
  DISABLED: 'bad',
};

const mototaxiTones: Record<MototaxiStatus, Tone> = {
  AVAILABLE: 'good',
  DISABLED: 'bad',
  OUT_OF_SERVICE: 'warn',
};

const tripTones: Record<TripStatus, Tone> = {
  REQUESTED: 'warn',
  OFFERED: 'warn',
  ACCEPTED: 'busy',
  EN_ROUTE: 'busy',
  ARRIVED: 'busy',
  IN_TRIP: 'busy',
  COMPLETED: 'good',
  CANCELLED: 'idle',
  NO_DRIVER: 'bad',
};

export type StatusBadgeProps = {
  kind: 'driver' | 'mototaxi' | 'trip';
  /** Widened to `string`: an unknown status must still render, not crash. */
  value: string;
  title?: string;
};

function resolve(kind: StatusBadgeProps['kind'], value: string): { label: string; tone: Tone } {
  if (kind === 'driver') {
    const label = strings.status.driver[value as DriverStatus];
    return { label: label ?? value, tone: driverTones[value as DriverStatus] ?? 'neutral' };
  }
  if (kind === 'mototaxi') {
    const label = strings.status.mototaxi[value as MototaxiStatus];
    return { label: label ?? value, tone: mototaxiTones[value as MototaxiStatus] ?? 'neutral' };
  }
  const label = strings.status.trip[value as TripStatus];
  return { label: label ?? value, tone: tripTones[value as TripStatus] ?? 'neutral' };
}

export function StatusBadge({ kind, value, title }: StatusBadgeProps) {
  const { label, tone } = resolve(kind, value);
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}

/** Neutral pill for the warnings that sit next to a status, not replace it. */
export function WarningBadge({ children, title }: { children: string; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-amber-900 ring-1 ring-amber-200 ring-inset"
    >
      {children}
    </span>
  );
}
