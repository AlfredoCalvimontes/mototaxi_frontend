import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';

import type { MototaxiSummary } from '@/api/types';
import { EMPTY, formatRelative } from '@/lib/format';
import { strings } from '@/lib/strings';

/** Villa Montes (spec §2), used when nothing has a position to centre on. */
const CITY_CENTER: [number, number] = [-21.26235, -63.46903];

/**
 * Leaflet's default marker icons are resolved from a CDN path that does not
 * exist in a bundled app, so markers silently vanish. A div icon avoids the
 * asset question entirely and lets a stale tracker be coloured differently.
 */
function markerIcon(stale: boolean) {
  const color = stale ? '#d97706' : '#059669';
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${color};box-shadow:0 0 0 3px rgba(255,255,255,.9),0 0 0 4px ${color}"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

type Located = MototaxiSummary & { lat: number; lon: number };

function hasPosition(unit: MototaxiSummary): unit is Located {
  return unit.lat !== null && unit.lon !== null;
}

export function FleetMap({ units }: { units: MototaxiSummary[] }) {
  const located = units.filter(hasPosition);

  if (located.length === 0) {
    return (
      <div className="grid h-72 place-items-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        {strings.mototaxis.mapUnavailable}
      </div>
    );
  }

  const center: [number, number] = [located[0]!.lat, located[0]!.lon];

  return (
    <MapContainer
      center={located.length === 1 ? center : CITY_CENTER}
      zoom={14}
      scrollWheelZoom={false}
      className="h-72 w-full rounded-lg border border-slate-200"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {located.map((unit) => (
        <Marker
          key={unit.mototaxi_uuid}
          position={[unit.lat, unit.lon]}
          icon={markerIcon(unit.is_tracker_stale)}
        >
          <Popup>
            <p className="font-medium">{unit.plate_number}</p>
            <p className="text-xs text-slate-600">
              {strings.mototaxis.lastUpdate}: {formatRelative(unit.location_updated_at) || EMPTY}
            </p>
            {unit.is_tracker_stale && (
              <p className="text-xs font-medium text-amber-700">{strings.mototaxis.staleTracker}</p>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
