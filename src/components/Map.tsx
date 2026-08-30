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
  navPosition: { lat: number; lng: number; bearing?: number; mode?: string } | null;
  flyToCoord?: { lat: number; lng: number } | null;
  mapStyleKey?: string;
  isDark?: boolean;
  is3D?: boolean;
  bearing?: number;
}

const ROUTE_COLORS: Record<string, string> = {
  coolest: '#10B981',   // Emerald Green
  fastest: '#64748B',   // Slate Gray
  route_1: '#3B82F6',   // Blue
  route_2: '#8B5CF6',   // Purple
  route_3: '#F59E0B',   // Amber
};

const Map: React.FC<MapProps> = ({
  missionResponse,
  originCoord,
  destinationCoord,
  pinMode,
  onMapClick,
  selectedRouteId,
  onSelectRoute,
  navPosition,
  flyToCoord,
  mapStyleKey = 'theme',
  isDark = true,
  is3D = false,
  bearing = 0,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const originMarker = useRef<mapboxgl.Marker | null>(null);
  const destMarker = useRef<mapboxgl.Marker | null>(null);
  const navMarker = useRef<mapboxgl.Marker | null>(null);
  const clickHandlerRef = useRef<((e: mapboxgl.MapMouseEvent) => void) | null>(null);

  // Map style resolution helper
  const getStyleUrl = (key: string) => {
    if (key === 'satellite') return 'mapbox://styles/mapbox/satellite-streets-v12';
    if (key === 'outdoors') return 'mapbox://styles/mapbox/outdoors-v12';
    if (key === 'light') return 'mapbox://styles/mapbox/light-v11';
    if (key === 'dark') return 'mapbox://styles/mapbox/dark-v11';
    return isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11';
  };

  // Initialise map once
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = (import.meta as any).env?.VITE_MAPBOX_TOKEN || '';

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: getStyleUrl(mapStyleKey),
      center: [-74.0090, 40.7110],
      zoom: 14,
      pitch: is3D ? 60 : 0,
      bearing: bearing || 0,
      dragRotate: true,
      pitchWithRotate: true,
      touchPitch: true,
      touchZoomRotate: true,
      maxPitch: 85,
    });

    // Ensure all rotation and pitch gesture handlers are explicitly enabled
    m.dragRotate.enable();
    m.touchPitch.enable();
    m.touchZoomRotate.enable();

    m.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    map.current = m;

    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Trackpad Wheel & 2-Finger Touch Pitch/Rotate Handler
  useEffect(() => {
    const el = mapContainer.current;
    if (!el) return;

    // 1. Wheel / Trackpad scroll gesture (Shift + Scroll OR Alt + Scroll OR Ctrl + Scroll)
    const handleWheel = (e: WheelEvent) => {
      if (!map.current) return;
      if (e.shiftKey || e.altKey || e.ctrlKey) {
        e.preventDefault();
        const m = map.current;
        const currentPitch = m.getPitch();
        const currentBearing = m.getBearing();

        const deltaPitch = -e.deltaY * 0.3;
        const deltaBearing = e.deltaX * 0.3;

        m.setPitch(Math.min(85, Math.max(0, currentPitch + deltaPitch)));
        m.setBearing(currentBearing + deltaBearing);
      }
    };

    // 2. Touchscreen 2-finger drag pitch & rotate
    let initialAngle = 0;
    let initialPitch = 0;
    let initialBearing = 0;
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2 && map.current) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        startY = (t1.clientY + t2.clientY) / 2;
        initialAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
        initialPitch = map.current.getPitch();
        initialBearing = map.current.getBearing();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && map.current) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentY = (t1.clientY + t2.clientY) / 2;
        const currentAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
        
        const dy = startY - currentY;
        const newPitch = Math.min(85, Math.max(0, initialPitch + dy * 0.4));
        const dAngle = currentAngle - initialAngle;
        const newBearing = initialBearing + dAngle;

        map.current.setPitch(newPitch);
        map.current.setBearing(newBearing);
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Update 3D pitch and bearing
  useEffect(() => {
    if (!map.current) return;
    map.current.easeTo({
      pitch: is3D ? 60 : 0,
      bearing: bearing ?? (is3D ? -17.6 : 0),
      duration: 1000,
    });
  }, [is3D, bearing]);

  // Update map style when mapStyleKey or isDark changes
  useEffect(() => {
    if (!map.current) return;
    const url = getStyleUrl(mapStyleKey);
    map.current.setStyle(url);
    map.current.once('styledata', () => {
      drawAllRoutes();
    });
  }, [mapStyleKey, isDark]);

  // Fly to coordinate when flyToCoord changes
  useEffect(() => {
    if (!map.current || !flyToCoord) return;
    map.current.flyTo({ center: [flyToCoord.lng, flyToCoord.lat], zoom: 15, duration: 1200 });
  }, [flyToCoord]);

  // Helper function to draw routes
  const drawAllRoutes = () => {
    const m = map.current;
    if (!m) return;

    // Remove old layers
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
    if (routeOptions.length === 0 && missionResponse?.routes) {
      if (missionResponse.routes.fastest?.length > 1) {
        routeOptions.push({
          id: 'fastest',
          name: 'Direct Fastest',
          tag: '⚡ Fastest',
          travel_minutes: missionResponse.comparison?.fastest?.travel_minutes || 0,
          avg_temp_c: 33.5,
          thermal_exposure: missionResponse.comparison?.fastest?.thermal_exposure || 55,
          thermal_reduction_percent: 0,
          coordinates: missionResponse.routes.fastest,
          explanation: '',
          is_recommended: false,
        });
      }
      if (missionResponse.routes.recommended?.length > 1) {
        routeOptions.push({
          id: 'recommended',
          name: 'CoolPath Route',
          tag: '❄️ Coolest',
          travel_minutes: missionResponse.comparison?.recommended?.travel_minutes || 0,
          avg_temp_c: 31.8,
          thermal_exposure: missionResponse.comparison?.recommended?.thermal_exposure || 45,
          thermal_reduction_percent: missionResponse.thermal_reduction_percent || 0,
          coordinates: missionResponse.routes.recommended,
          explanation: missionResponse.explanation || '',
          is_recommended: true,
        });
      }
    }

    if (routeOptions.length === 0) return;

    const activeId = selectedRouteId || routeOptions[0]?.id;

    // Draw non-selected routes first (underneath), then selected route on top
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

      // Visible Route Line
      m.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': isSelected ? (route.is_recommended ? '#10B981' : '#3B82F6') : baseColor,
          'line-width': isSelected ? 6 : 4,
          'line-opacity': isSelected ? 1.0 : 0.45,
          ...(isSelected ? {} : { 'line-dasharray': [2, 1] }),
        },
      });

      // Invisible wider hit area for easy clicking
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

      // Click on route polyline
      m.on('click', hitLayerId, () => {
        if (onSelectRoute) onSelectRoute(route.id);
      });

      m.on('mouseenter', hitLayerId, () => {
        m.getCanvas().style.cursor = 'pointer';
      });
      m.on('mouseleave', hitLayerId, () => {
        if (!pinMode) m.getCanvas().style.cursor = '';
      });

      if (isSelected) {
        route.coordinates.forEach((c) => {
          bounds.extend(c as [number, number]);
          hasCoords = true;
        });
      }
    });

    if (hasCoords) {
      m.fitBounds(bounds, { padding: 70, duration: 700 });
    }
  };

  // Re-draw routes when response or selection changes
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (m.isStyleLoaded()) drawAllRoutes();
    else m.once('styledata', drawAllRoutes);
  }, [missionResponse, selectedRouteId]);

  // Handle click-to-pin mode
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

  // Origin marker
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
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        cursor: pointer;
      `;
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([originCoord.lng, originCoord.lat])
        .setPopup(new mapboxgl.Popup({ offset: 20 }).setHTML('<strong>Origin</strong>'))
        .addTo(m);
      originMarker.current = marker;
    }
  }, [originCoord]);

  // Destination marker
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
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        cursor: pointer;
      `;
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([destinationCoord.lng, destinationCoord.lat])
        .setPopup(new mapboxgl.Popup({ offset: 20 }).setHTML('<strong>Destination</strong>'))
        .addTo(m);
      destMarker.current = marker;
    }
  }, [destinationCoord]);

  // Dynamic Navigation Simulator Marker
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    if (navMarker.current) {
      navMarker.current.remove();
      navMarker.current = null;
    }

    if (navPosition) {
      const el = document.createElement('div');
      el.className = 'nav-simulator-pin';
      
      // Determine simulator avatar based on activity mode
      let avatarEmoji = '🚶';
      if (navPosition.mode === 'running') avatarEmoji = '🏃';
      else if (navPosition.mode === 'biking') avatarEmoji = '🚴';
      else if (navPosition.mode === 'driving') avatarEmoji = '🚗';

      el.style.cssText = `
        width: 32px; height: 32px; border-radius: 50%;
        background: #3b82f6; border: 2.5px solid white;
        box-shadow: 0 0 12px #3b82f6;
        display: flex; align-items: center; justify-content: center;
        font-size: 16px; transition: transform 0.25s ease-out;
        transform: rotate(${navPosition.bearing || 0}deg);
      `;
      el.innerHTML = avatarEmoji;

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([navPosition.lng, navPosition.lat])
        .addTo(m);
      navMarker.current = marker;

      // Smoothly pan camera during active simulation to follow traveler
      m.easeTo({
        center: [navPosition.lng, navPosition.lat],
        duration: 250,
      });
    }
  }, [navPosition]);

  // Fly to show both pins when they change
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    if (originCoord && destinationCoord) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([originCoord.lng, originCoord.lat]);
      bounds.extend([destinationCoord.lng, destinationCoord.lat]);
      m.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 700 });
    } else if (originCoord) {
      m.flyTo({ center: [originCoord.lng, originCoord.lat], zoom: 15, duration: 600 });
    } else if (destinationCoord) {
      m.flyTo({ center: [destinationCoord.lng, destinationCoord.lat], zoom: 15, duration: 600 });
    }
  }, [originCoord, destinationCoord]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Crosshair overlay hint */}
      {pinMode && (
        <div style={{
          position: 'absolute',
          top: '72px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: pinMode === 'origin' ? '#10b981' : '#ef4444',
          color: 'white',
          padding: '8px 18px',
          borderRadius: '20px',
          fontSize: '13px',
          fontWeight: 700,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          {pinMode === 'origin' ? '🟢' : '🔴'} Click map to set {pinMode === 'origin' ? 'Origin' : 'Destination'}
        </div>
      )}
    </div>
  );
};

export default Map;
