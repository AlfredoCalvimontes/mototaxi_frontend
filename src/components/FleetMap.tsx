import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Polygon, Popup, TileLayer, Tooltip } from 'react-leaflet';

import type { GeoJsonPolygon, VehicleSummary } from '@/api/types';
import { toLatLngs } from '@/lib/geo';
import { EMPTY, formatRelative, markerLabel } from '@/lib/format';
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

type Located = VehicleSummary & { lat: number; lon: number };

function hasPosition(unit: VehicleSummary): unit is Located {
  return unit.lat !== null && unit.lon !== null;
}

export function FleetMap({
  units,
  geofences = [],
  typeNames,
}: {
  units: VehicleSummary[];
  /** Service perimeters of the cities in view, drawn under the markers. */
  geofences?: GeoJsonPolygon[];
  /** Display name per vehicle type uuid; shown next to each marker's label. */
  typeNames?: Map<string, string>;
}) {
  const located = units.filter(hasPosition);
  const typeOf = (unit: VehicleSummary) =>
    unit.vehicle_type_uuid ? typeNames?.get(unit.vehicle_type_uuid) : undefined;

  if (located.length === 0) {
    return (
      <div className="grid h-72 place-items-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        {strings.vehicles.mapUnavailable}
      </div>
    );
  }

  const center: [number, number] = [located[0]!.lat, located[0]!.lon];

  return (
    <MapContainer
      center={located.length === 1 ? center : CITY_CENTER}
      zoom={14}
      scrollWheelZoom={false}
      // `isolate` keeps Leaflet's panes (z-index up to 1000) inside the map's own
      // stacking context; without it they paint over the z-50 dialogs.
      className="isolate h-72 w-full rounded-lg border border-slate-200"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {geofences.map((polygon, index) => (
        <Polygon
          key={index}
          positions={toLatLngs(polygon)}
          pathOptions={{ color: '#0f172a', weight: 2, dashArray: '6 4', fillOpacity: 0.05 }}
          interactive={false}
        />
      ))}
      {located.map((unit) => (
        <Marker
          key={unit.vehicle_uuid}
          position={[unit.lat, unit.lon]}
          icon={markerIcon(unit.is_tracker_stale)}
        >
          {/* Always visible, so a dot can be matched to a unit without clicking it. */}
          <Tooltip permanent direction="right" offset={[10, 0]}>
            {markerLabel(unit)}
            {typeOf(unit) && ` · ${typeOf(unit)}`}
          </Tooltip>
          <Popup>
            <p className="font-medium">
              {unit.alias ? `${unit.alias} · ${unit.plate_number}` : unit.plate_number}
            </p>
            <p className="text-xs text-slate-600">
              {strings.vehicles.lastUpdate}: {formatRelative(unit.location_updated_at) || EMPTY}
            </p>
            {unit.is_tracker_stale && (
              <p className="text-xs font-medium text-amber-700">{strings.vehicles.staleTracker}</p>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
