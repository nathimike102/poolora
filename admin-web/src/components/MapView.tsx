import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const STYLE = (import.meta.env.VITE_MAP_STYLE as string | undefined) ?? 'https://tiles.openfreemap.org/styles/liberty';

export interface MapPoint {
  lng: number;
  lat: number;
}

/** Another phone on the ride: the car, or another rider */
export interface OtherTrail {
  id: string;
  label: string;
  color: string;
  points: MapPoint[];
}

function markerDot(color: string, label: string, pulse: boolean): HTMLElement {
  const dot = document.createElement('div');
  dot.style.cssText = `width:${pulse ? 18 : 14}px;height:${pulse ? 18 : 14}px;border-radius:50%;background:${color};border:3px solid #fff;${pulse ? `box-shadow:0 0 0 6px ${color}40` : 'box-shadow:0 1px 3px rgba(0,0,0,.4)'}`;
  dot.setAttribute('aria-label', label);
  dot.title = label;
  return dot;
}

/**
 * The SOS map: the person's trail as a line, the trigger point, and their
 * latest position as a pulsing marker that moves as updates arrive. Every
 * other phone on the ride (the car, other riders) is drawn too, each in its
 * own colour with a labelled marker at its latest position.
 */
export function MapView({ trail, trigger, label, others = [] }: { trail: MapPoint[]; trigger?: MapPoint; label: string; others?: OtherTrail[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const otherMarkers = useRef(new Map<string, maplibregl.Marker>());
  const fitted = useRef(false);

  useEffect(() => {
    if (!el.current) return;
    const start = trail[trail.length - 1] ?? trigger ?? { lng: 0, lat: 0 };
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
    const markers = otherMarkers.current;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
      markers.clear();
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

    for (const o of others) {
      const source = `other-${o.id}`;
      const line = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: o.points.map((p) => [p.lng, p.lat]) } };
      const existing = m.getSource(source) as maplibregl.GeoJSONSource | undefined;
      if (existing) existing.setData(line);
      else {
        m.addSource(source, { type: 'geojson', data: line });
        m.addLayer({ id: source, type: 'line', source, paint: { 'line-color': o.color, 'line-width': 3, 'line-opacity': 0.7, 'line-dasharray': [2, 1] } });
      }
      const last = o.points[o.points.length - 1];
      if (!last) continue;
      const mk = otherMarkers.current.get(o.id);
      if (mk) mk.setLngLat([last.lng, last.lat]);
      else {
        otherMarkers.current.set(o.id, new maplibregl.Marker({ element: markerDot(o.color, o.label, false) })
          .setLngLat([last.lng, last.lat])
          .setPopup(new maplibregl.Popup().setText(o.label))
          .addTo(m));
      }
    }

    const latest = trail[trail.length - 1] ?? trigger;
    if (!latest) return;
    if (!marker.current) {
      marker.current = new maplibregl.Marker({ element: markerDot('#c0282d', label, true) }).setLngLat([latest.lng, latest.lat]).addTo(m);
    } else {
      marker.current.setLngLat([latest.lng, latest.lat]);
    }
    const all = [...coords, ...others.flatMap((o) => o.points.map((p) => [p.lng, p.lat]))];
    if (!fitted.current && all.length > 1) {
      const bounds = all.reduce((b, c) => b.extend(c as [number, number]), new maplibregl.LngLatBounds(all[0] as [number, number], all[0] as [number, number]));
      m.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 0 });
      fitted.current = true;
    } else if (fitted.current) {
      m.easeTo({ center: [latest.lng, latest.lat], duration: 600 });
    }
  };

  useEffect(draw);

  return <div ref={el} className="map" role="region" aria-label={label} />;
}
