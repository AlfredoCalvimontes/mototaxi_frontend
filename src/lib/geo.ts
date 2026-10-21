import type { GeoJsonPolygon } from '@/api/types';

/** GeoJSON rings are `[lon, lat]`; Leaflet wants `[lat, lon]`. */
export function toLatLngs(polygon: GeoJsonPolygon): [number, number][] {
  return (polygon.coordinates[0] ?? []).map(([lon, lat]) => [lat as number, lon as number]);
}
