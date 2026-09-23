import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const STYLE = (import.meta.env.VITE_MAP_STYLE as string | undefined) ?? 'https://tiles.openfreemap.org/styles/liberty';

export interface MapPoint {
  lng: number;
  lat: number;
}

/**
 * The SOS map: the trail of positions as a line, the trigger point, and the
 * latest position as a pulsing marker that moves as updates arrive.
 */
export function MapView({ trail, trigger, label }: { trail: MapPoint[]; trigger?: MapPoint; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    if (!el.current) return;
    const start = trail[trail.length - 1] ?? trigger ?? { lng: 78.9, lat: 20.6 };
    const m = new maplibregl.Map({ container: el.current, style: STYLE, center: [start.lng, start.lat], zoom: 14, attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.on('load', () => {
      m.addSource('trail', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } } });
      m.addLayer({ id: 'trail', type: 'line', source: 'trail', paint: { 'line-color': '#c0282d', 'line-width': 3, 'line-opacity': 0.8 } });
      if (trigger) {
        new maplibregl.Marker({ color: '#75746f' }).setLngLat([trigger.lng, trigger.lat]).setPopup(new maplibregl.Popup().setText('Where the SOS was raised')).addTo(m);
      }
      map.current = m;
      draw();
    });
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
      fitted.current = false;
    };
    // The map is created once; positions are drawn by the effect below
  }, []);

  const draw = () => {
    const m = map.current;
    if (!m) return;
    const coords = trail.map((p) => [p.lng, p.lat]);
    (m.getSource('trail') as maplibregl.GeoJSONSource | undefined)?.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    });
    const latest = trail[trail.length - 1] ?? trigger;
    if (!latest) return;
    if (!marker.current) {
      const dot = document.createElement('div');
      dot.style.cssText = 'width:18px;height:18px;border-radius:50%;background:#c0282d;border:3px solid #fff;box-shadow:0 0 0 6px rgba(192,40,45,.25)';
      dot.setAttribute('aria-label', label);
      marker.current = new maplibregl.Marker({ element: dot }).setLngLat([latest.lng, latest.lat]).addTo(m);
    } else {
      marker.current.setLngLat([latest.lng, latest.lat]);
    }
    if (!fitted.current && coords.length > 1) {
      const bounds = coords.reduce((b, c) => b.extend(c as [number, number]), new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number]));
      m.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 0 });
      fitted.current = true;
    } else {
      m.easeTo({ center: [latest.lng, latest.lat], duration: 600 });
    }
  };

  useEffect(draw);

  return <div ref={el} className="map" role="region" aria-label={label} />;
}
