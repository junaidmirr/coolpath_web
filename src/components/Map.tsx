import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { MissionResponse, RouteOption } from '../types/mission';

export type PinMode = 'origin' | 'destination' | null;

interface MapProps {
  missionResponse: MissionResponse | null;
  originCoord: { lat: number; lng: number } | null;
  destinationCoord: { lat: number; lng: number } | null;
  pinMode: PinMode;
  onMapClick: (lat: number, lng: number) => void;
  selectedRouteId?: string;
  onSelectRoute?: (id: string) => void;
}

const ROUTE_COLORS: Record<string, string> = {
  coolest: '#10B981',
  fastest: '#64748B',
  route_1: '#3B82F6',
  route_2: '#8B5CF6',
  route_3: '#F59E0B',
};

const Map: React.FC<MapProps> = ({
  missionResponse,
  originCoord,
  destinationCoord,
  pinMode,
  onMapClick,
  selectedRouteId,
  onSelectRoute
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const originMarker = useRef<mapboxgl.Marker | null>(null);
  const destMarker = useRef<mapboxgl.Marker | null>(null);
  const clickHandlerRef = useRef<((e: mapboxgl.MapMouseEvent) => void) | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = (import.meta as any).env?.VITE_MAPBOX_TOKEN || '';

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapboxgl.accessToken
        ? 'mapbox://styles/mapbox/light-v11'
        : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [-98.5795, 39.8283], // Center of US
      zoom: 3.5
    });

    m.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    map.current = m;

    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;

    if (clickHandlerRef.current) {
      m.off('click', clickHandlerRef.current);
    }

    if (pinMode) {
      m.getCanvas().style.cursor = 'crosshair';
      const handler = (e: mapboxgl.MapMouseEvent) => {
        onMapClick(e.lngLat.lat, e.lngLat.lng);
      };
      clickHandlerRef.current = handler;
      m.on('click', handler);
    } else {
      m.getCanvas().style.cursor = '';
      clickHandlerRef.current = null;
    }

    return () => {
      if (clickHandlerRef.current && m) {
        m.off('click', clickHandlerRef.current);
        m.getCanvas().style.cursor = '';
      }
    };
  }, [pinMode, onMapClick]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;

    if (originMarker.current) {
      originMarker.current.remove();
      originMarker.current = null;
    }

    if (originCoord) {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 18px; height: 18px; border-radius: 50%;
        background: #10b981; border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
      `;
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([originCoord.lng, originCoord.lat])
        .setPopup(new mapboxgl.Popup({ offset: 20 }).setHTML('<strong>Origin</strong>'))
        .addTo(m);
      originMarker.current = marker;
    }
  }, [originCoord]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;

    if (destMarker.current) {
      destMarker.current.remove();
      destMarker.current = null;
    }

    if (destinationCoord) {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 18px; height: 18px; border-radius: 50%;
        background: #ef4444; border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
      `;
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([destinationCoord.lng, destinationCoord.lat])
        .setPopup(new mapboxgl.Popup({ offset: 20 }).setHTML('<strong>Destination</strong>'))
        .addTo(m);
      destMarker.current = marker;
    }
  }, [destinationCoord]);

  useEffect(() => {
    const m = map.current;
    if (!m || missionResponse) return; // Skip if route response exists

    if (originCoord && destinationCoord) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([originCoord.lng, originCoord.lat]);
      bounds.extend([destinationCoord.lng, destinationCoord.lat]);
      m.fitBounds(bounds, { padding: 100, maxZoom: 14, duration: 800 });
    } else if (originCoord) {
      m.flyTo({ center: [originCoord.lng, originCoord.lat], zoom: 12, duration: 600 });
    } else if (destinationCoord) {
      m.flyTo({ center: [destinationCoord.lng, destinationCoord.lat], zoom: 12, duration: 600 });
    }
  }, [originCoord, destinationCoord, missionResponse]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;

    const drawRoutes = () => {
      const style = m.getStyle();
      if (style && style.layers) {
        style.layers.forEach((layer) => {
          if (layer.id.startsWith('route-layer-') || layer.id.startsWith('route-hit-')) {
            if (m.getLayer(layer.id)) m.removeLayer(layer.id);
          }
        });
      }
      if (style && style.sources) {
        Object.keys(style.sources).forEach((srcId) => {
          if (srcId.startsWith('route-source-')) {
            if (m.getSource(srcId)) m.removeSource(srcId);
          }
        });
      }

      const routeOptions: RouteOption[] = missionResponse?.route_options || [];
      if (routeOptions.length === 0) return;

      const activeId = selectedRouteId || routeOptions[0]?.id;
      const sortedToDraw = [...routeOptions].sort((a, b) => {
        if (a.id === activeId) return 1;
        if (b.id === activeId) return -1;
        return 0;
      });

      const bounds = new mapboxgl.LngLatBounds();
      let hasCoords = false;

      sortedToDraw.forEach((route) => {
        if (!route.coordinates || route.coordinates.length < 2) return;

        const isSelected = route.id === activeId;
        const sourceId = `route-source-${route.id}`;
        const layerId = `route-layer-${route.id}`;
        const hitLayerId = `route-hit-${route.id}`;

        const baseColor =
          ROUTE_COLORS[route.id] ||
          (route.is_recommended ? '#10B981' : route.id === 'fastest' ? '#64748B' : '#3B82F6');

        m.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: { id: route.id, name: route.name },
            geometry: {
              type: 'LineString',
              coordinates: route.coordinates,
            },
          },
        });

        m.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': isSelected ? (route.is_recommended ? '#10B981' : '#2563EB') : baseColor,
            'line-width': isSelected ? 6 : 4,
            'line-opacity': isSelected ? 1.0 : 0.45,
            ...(isSelected ? {} : { 'line-dasharray': [2, 1] }),
          },
        });

        m.addLayer({
          id: hitLayerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': 'transparent',
            'line-width': 16,
          },
        });

        m.on('click', hitLayerId, () => {
          if (onSelectRoute) onSelectRoute(route.id);
        });

        m.on('mouseenter', hitLayerId, () => {
          m.getCanvas().style.cursor = 'pointer';
        });
        m.on('mouseleave', hitLayerId, () => {
          if (!pinMode) m.getCanvas().style.cursor = '';
        });

        route.coordinates.forEach((c) => {
          bounds.extend(c as [number, number]);
          hasCoords = true;
        });
      });

      if (hasCoords) {
        m.fitBounds(bounds, { padding: 90, duration: 800 });
      }
    };

    if (m.isStyleLoaded()) drawRoutes();
    else m.once('styledata', drawRoutes);
  }, [missionResponse, selectedRouteId, onSelectRoute]);

  const activeOptions = missionResponse?.route_options || [];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {pinMode && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: pinMode === 'origin' ? '#10b981' : '#ef4444',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '13px',
          fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          pointerEvents: 'none'
        }}>
          {pinMode === 'origin' ? '🟢' : '🔴'} Click to set {pinMode === 'origin' ? 'origin' : 'destination'}
        </div>
      )}

      {activeOptions.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '30px',
          left: '16px',
          background: 'white',
          borderRadius: '10px',
          padding: '12px 16px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
          fontSize: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '220px'
        }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Routes (Click to select)
          </span>
          {activeOptions.map((r) => {
            const isSel = r.id === (selectedRouteId || activeOptions[0]?.id);
            const color =
              ROUTE_COLORS[r.id] ||
              (r.is_recommended ? '#10B981' : r.id === 'fastest' ? '#64748B' : '#3B82F6');
            return (
              <div
                key={r.id}
                onClick={() => onSelectRoute && onSelectRoute(r.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: '6px',
                  background: isSel ? '#f1f5f9' : 'transparent',
                  fontWeight: isSel ? 700 : 500,
                  color: isSel ? '#0f172a' : '#475569'
                }}
              >
                <div style={{
                  width: '18px',
                  height: isSel ? '4px' : '3px',
                  background: isSel ? (r.is_recommended ? '#10B981' : '#2563EB') : color,
                  borderRadius: '2px'
                }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name} ({r.travel_minutes}m)
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Map;