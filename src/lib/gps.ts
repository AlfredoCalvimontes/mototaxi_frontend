import type { VehicleSummary } from '@/api/types';
import { strings } from '@/lib/strings';

/**
 * How a vehicle is being tracked, said plainly.
 *
 * The server reports each source on its own — the GPS tracker and the app on
 * the assigned driver's phone — as `none` (not in use), `ok` (recent fix) or
 * `silent` (in use but quiet). This turns the pair into one label so the
 * operator can tell "tracker dead, phone covering" from "phone dead, tracker
 * covering" at a glance.
 */
export type GpsKey =
  | 'none'
  | 'trackerOk'
  | 'trackerSilent'
  | 'phoneOk'
  | 'phoneSilent'
  | 'trackerSilentPhoneOk'
  | 'trackerOkPhoneSilent'
  | 'bothOk'
  | 'bothSilent';

export type GpsStatus = {
  key: GpsKey;
  label: string;
  hint: string;
  tone: 'good' | 'warn' | 'bad' | 'idle';
};

const g = strings.vehicles.gps;

const TABLE: Record<GpsKey, GpsStatus> = {
  none: { key: 'none', label: g.none, hint: g.noneHint, tone: 'idle' },
  trackerOk: { key: 'trackerOk', label: g.trackerOk, hint: g.trackerOkHint, tone: 'good' },
  trackerSilent: {
    key: 'trackerSilent',
    label: g.trackerSilent,
    hint: g.trackerSilentHint,
    tone: 'warn',
  },
  phoneOk: { key: 'phoneOk', label: g.phoneOk, hint: g.phoneOkHint, tone: 'good' },
  phoneSilent: {
    key: 'phoneSilent',
    label: g.phoneSilent,
    hint: g.phoneSilentHint,
    tone: 'warn',
  },
  trackerSilentPhoneOk: {
    key: 'trackerSilentPhoneOk',
    label: g.trackerSilentPhoneOk,
    hint: g.trackerSilentPhoneOkHint,
    tone: 'warn',
  },
  trackerOkPhoneSilent: {
    key: 'trackerOkPhoneSilent',
    label: g.trackerOkPhoneSilent,
    hint: g.trackerOkPhoneSilentHint,
    tone: 'warn',
  },
  bothOk: { key: 'bothOk', label: g.bothOk, hint: g.bothOkHint, tone: 'good' },
  bothSilent: {
    key: 'bothSilent',
    label: g.bothSilent,
    hint: g.bothSilentHint,
    tone: 'bad',
  },
};

export const GPS_KEYS = Object.keys(TABLE) as GpsKey[];

export function gpsLabel(key: GpsKey): string {
  return TABLE[key].label;
}

export function gpsStatus(unit: Pick<VehicleSummary, 'tracker_state' | 'phone_state'>): GpsStatus {
  const tracker = unit.tracker_state ?? 'none';
  const phone = unit.phone_state ?? 'none';
  if (tracker === 'none' && phone === 'none') return TABLE.none;
  if (phone === 'none') return tracker === 'ok' ? TABLE.trackerOk : TABLE.trackerSilent;
  if (tracker === 'none') return phone === 'ok' ? TABLE.phoneOk : TABLE.phoneSilent;
  if (tracker === 'ok' && phone === 'ok') return TABLE.bothOk;
  if (tracker === 'ok') return TABLE.trackerOkPhoneSilent;
  if (phone === 'ok') return TABLE.trackerSilentPhoneOk;
  return TABLE.bothSilent;
}
