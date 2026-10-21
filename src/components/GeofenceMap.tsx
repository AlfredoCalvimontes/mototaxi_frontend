import 'leaflet/dist/leaflet.css';
import { MapContainer, Polygon, TileLayer } from 'react-leaflet';

import type { GeoJsonPolygon } from '@/api/types';
import { toLatLngs } from '@/lib/geo';

/** Read-only outline of a city's service perimeter. Drawing is deferred (plan §4). */
export function GeofenceMap({ polygon }: { polygon: GeoJsonPolygon }) {
  const points = toLatLngs(polygon);
  if (points.length < 3) return null;
  return (
    <MapContainer
      bounds={points}
      boundsOptions={{ padding: [20, 20] }}
      scrollWheelZoom={false}
      className="h-64 w-full rounded-lg border border-slate-200"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polygon positions={points} pathOptions={{ color: '#0f172a', weight: 2, fillOpacity: 0.1 }} />
    </MapContainer>
  );
}
