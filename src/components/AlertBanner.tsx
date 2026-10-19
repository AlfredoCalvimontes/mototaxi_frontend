import { Link } from 'react-router-dom';

import type { Alerts } from '@/api/types';
import { strings } from '@/lib/strings';

/**
 * Alerts are only useful if they lead somewhere, so each count links to the
 * view already filtered to the rows it counted.
 *
 * `failed_actions` is the exception: failed scheduled actions live in the
 * backend and have no screen, so it reports without a link rather than
 * pretending to navigate.
 */
/**
 * Counts the panel works out itself from the fleet lists, so the server's
 * alerts need no change; absent while those lists load.
 */
export type PanelAlerts = Alerts & {
  trackers_without_credit?: number;
  drivers_without_credit?: number;
};

type AlertItem = { key: keyof PanelAlerts; label: string; to?: string };

const items: AlertItem[] = [
  {
    key: 'stale_trackers',
    label: strings.dashboard.alertStaleTrackers,
    to: '/mototaxis?gps=sin-senal',
  },
  { key: 'overdue_trips', label: strings.dashboard.alertOverdueTrips, to: '/viajes' },
  {
    key: 'auto_completed_trips',
    label: strings.dashboard.alertAutoCompleted,
    to: '/historial?cierre=automatico',
  },
  {
    key: 'drivers_without_checkin',
    label: strings.dashboard.alertNoCheckin,
    to: '/conductores?checkin=pendiente',
  },
  {
    key: 'trackers_without_credit',
    label: strings.dashboard.alertTrackersNoCredit,
    to: '/mototaxis?sim=vencida',
  },
  {
    key: 'drivers_without_credit',
    label: strings.dashboard.alertDriversNoCredit,
    to: '/conductores?credito=agotado',
  },
  { key: 'failed_actions', label: strings.dashboard.alertFailedActions },
];

export function AlertBanner({ alerts }: { alerts: PanelAlerts }) {
  const active = items.filter((item) => (alerts[item.key] ?? 0) > 0);

  if (active.length === 0) {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        {strings.dashboard.noAlerts}
      </p>
    );
  }

  return (
    <section
      aria-label={strings.dashboard.alertsHeading}
      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3"
    >
      <h2 className="text-sm font-semibold text-amber-900">{strings.dashboard.alertsHeading}</h2>
      <ul className="mt-2 space-y-1 text-sm text-amber-900">
        {active.map((item) => {
          const count = alerts[item.key] ?? 0;
          const text = `${count} ${item.label}`;
          return (
            <li key={item.key}>
              {item.to ? (
                <Link to={item.to} className="underline underline-offset-2 hover:text-amber-950">
                  {text}
                </Link>
              ) : (
                text
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
