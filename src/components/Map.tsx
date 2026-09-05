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

  // Chevron Arrow Icon registration
  const registerArrowIcon = (m: mapboxgl.Map) => {
    if (m.hasImage('nav-chevron')) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(8, 6);
      ctx.lineTo(24, 16);
      ctx.lineTo(8, 26);
      ctx.stroke();
      const imgData = ctx.getImageData(0, 0, 32, 32);
      m.addImage('nav-chevron', imgData);
    } catch {}
  };

  // Turn point detection helper
  const calculateTurnPoints = (coords: [number, number][]) => {
    const turnPoints: any[] = [];
    if (coords.length < 3) return turnPoints;
    for (let i = 1; i < coords.length - 1; i++) {
      const pPrev = coords[i - 1];
      const pCurr = coords[i];
      const pNext = coords[i + 1];
      const b1 = (Math.atan2(pCurr[0] - pPrev[0], pCurr[1] - pPrev[1]) * 180) / Math.PI;
      const b2 = (Math.atan2(pNext[0] - pCurr[0], pNext[1] - pCurr[1]) * 180) / Math.PI;
      let angle = Math.abs(b2 - b1);
      if (angle > 180) angle = 360 - angle;
      if (angle > 30) {
        turnPoints.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: pCurr },
          properties: { angle: Math.round(angle) },
        });
      }
    }
    return turnPoints;
  };

  // Helper function to draw routes with mobile-parity chevrons, temperature badges, and glow
  const drawAllRoutes = () => {
    const m = map.current;
    if (!m) return;
    registerArrowIcon(m);

    // Clean up old layers & sources
    const style = m.getStyle();
    if (style && style.layers) {
      style.layers.forEach((layer) => {
        if (
          layer.id.startsWith('casing-') ||
          layer.id.startsWith('glow-') ||
          layer.id.startsWith('line-') ||
          layer.id.startsWith('arrow-') ||
          layer.id.startsWith('turn-') ||
          layer.id.startsWith('temp-lbl-') ||
          layer.id.startsWith('route-layer-') ||
          layer.id.startsWith('route-hit-')
        ) {
          if (m.getLayer(layer.id)) m.removeLayer(layer.id);
        }
      });
    }
    if (style && style.sources) {
      Object.keys(style.sources).forEach((srcId) => {
        if (
          srcId.startsWith('src-') ||
          srcId.startsWith('turn-src-') ||
          srcId.startsWith('temp-src-') ||
          srcId.startsWith('route-source-')
        ) {
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
          tag: 'Fastest',
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
          tag: 'Coolest',
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

    // Draw unselected routes first, selected route on top
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
      const srcId = `src-${route.id}`;
      const casingId = `casing-${route.id}`;
      const glowId = `glow-${route.id}`;
      const lineId = `line-${route.id}`;
      const arrowId = `arrow-${route.id}`;
      const turnSrcId = `turn-src-${route.id}`;
      const turnId = `turn-${route.id}`;

      const baseColor =
        ROUTE_COLORS[route.id] ||
        (route.is_recommended ? '#10B981' : route.id === 'fastest' ? '#64748B' : '#3B82F6');

      // Thermal gradient calculations
      let lineGradientExpression: any = null;
      const gTemps = (isSelected && route.geometry_temps && route.geometry_temps.length >= 2) ? route.geometry_temps : null;

      if (gTemps) {
        const distances = [0];
        let totalDist = 0;
        for (let i = 1; i < gTemps.length; i++) {
          const p1 = gTemps[i - 1];
          const p2 = gTemps[i];
          const dx = (p2[0] - p1[0]) * Math.cos(((p1[1] + p2[1]) * Math.PI) / 360.0);
          const dy = p2[1] - p1[1];
          const d = Math.sqrt(dx * dx + dy * dy);
          totalDist += d;
          distances.push(totalDist);
        }

        if (totalDist > 0) {
          const getTempColor = (t: number) => {
            if (t <= 24) return '#10B981'; // Cool Green
            if (t <= 28) return '#38BDF8'; // Mild Blue
            if (t <= 33) return '#F59E0B'; // Warm Amber
            return '#EF4444'; // Hot Red
          };

          const stops: any[] = [];
          let lastProgress = -1;
          for (let i = 0; i < gTemps.length; i++) {
            let progress = distances[i] / totalDist;
            if (progress <= lastProgress) progress = lastProgress + 0.001;
            if (progress > 1.0) progress = 1.0;
            stops.push(progress, getTempColor(gTemps[i][2]));
            lastProgress = progress;
          }
          lineGradientExpression = ['interpolate', ['linear'], ['line-progress'], ...stops];
        }
      }

      // Add Source
      try {
        m.addSource(srcId, {
          type: 'geojson',
          lineMetrics: !!lineGradientExpression,
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: route.coordinates,
            },
          },
        });
      } catch {}

      // 1. Under-Casing Layer (Dark outline beneath line)
      try {
        m.addLayer({
          id: casingId,
          type: 'line',
          source: srcId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#020617',
            'line-width': isSelected ? 12 : 6,
            'line-opacity': isSelected ? 0.95 : 0.4,
          },
        });
      } catch {}

      // 2. Ambient Glow Halo for selected route
      if (isSelected) {
        try {
          m.addLayer({
            id: glowId,
            type: 'line',
            source: srcId,
            paint: {
              'line-color': baseColor,
              'line-width': 28,
              'line-opacity': 0.22,
              'line-blur': 10,
            },
          });
        } catch {}
      }

      // 3. Primary Route Polyline Layer
      try {
        const linePaint: any = {
          'line-width': isSelected ? 8 : 4,
          'line-opacity': isSelected ? 1.0 : 0.5,
        };

        if (lineGradientExpression) {
          linePaint['line-gradient'] = lineGradientExpression;
        } else {
          linePaint['line-color'] = baseColor;
        }

        m.addLayer({
          id: lineId,
          type: 'line',
          source: srcId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: linePaint,
        });
      } catch {}

      // 4. Directional Flow Chevrons (▶ ▶ ▶)
      try {
        m.addLayer({
          id: arrowId,
          type: 'symbol',
          source: srcId,
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': isSelected ? 55 : 90,
            'icon-image': 'nav-chevron',
            'icon-size': isSelected ? 0.55 : 0.38,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-rotation-alignment': 'map',
            'icon-keep-upright': false,
          },
          paint: {
            'icon-opacity': isSelected ? 0.9 : 0.35,
          },
        });
      } catch {}

      // 5. Turn Decision Circle Nodes
      if (isSelected) {
        const turns = calculateTurnPoints(route.coordinates as [number, number][]);
        if (turns.length > 0) {
          try {
            m.addSource(turnSrcId, {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: turns },
            });
            m.addLayer({
              id: turnId,
              type: 'circle',
              source: turnSrcId,
              paint: {
                'circle-radius': 5,
                'circle-color': '#FFFFFF',
                'circle-stroke-color': baseColor,
                'circle-stroke-width': 2.5,
                'circle-opacity': 0.95,
              },
            });
          } catch {}
        }
      }

      // 6. Segment Temperature Badges on Route Tiles (e.g. 24°, 31°, 36°)
      if (isSelected) {
        const tempsToSample = gTemps || route.coordinates.map((c, idx) => [
          c[0],
          c[1],
          route.avg_temp_c || (24 + (idx % 8))
        ]);

        if (tempsToSample.length >= 2) {
          const MAX_BADGES = 8;
          const step = Math.max(1, Math.floor(tempsToSample.length / MAX_BADGES));
          const tempFeatures: any[] = [];

          for (let i = 0; i < tempsToSample.length; i += step) {
            const pt = tempsToSample[i];
            const lng = pt[0], lat = pt[1], tempC = pt[2];
            if (!isFinite(lng) || !isFinite(lat) || !isFinite(tempC)) continue;

            const tempRounded = Math.round(tempC);
            let tempColor = '#10B981';
            if (tempC <= 24) tempColor = '#10B981';
            else if (tempC <= 28) tempColor = '#38BDF8';
            else if (tempC <= 33) tempColor = '#F59E0B';
            else tempColor = '#EF4444';

            tempFeatures.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lng, lat] },
              properties: {
                tempText: `${tempRounded}°`,
                tempColor,
              },
            });
          }

          const tempSrcId = `temp-src-${route.id}`;
          const tempLayerId = `temp-lbl-${route.id}`;

          try {
            m.addSource(tempSrcId, {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: tempFeatures },
            });

            m.addLayer({
              id: tempLayerId,
              type: 'symbol',
              source: tempSrcId,
              layout: {
                'text-field': ['get', 'tempText'],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': 12,
                'text-allow-overlap': false,
                'text-ignore-placement': false,
                'text-anchor': 'center',
                'text-offset': [0, 0],
              },
              paint: {
                'text-color': ['get', 'tempColor'],
                'text-halo-color': '#020617',
                'text-halo-width': 2.5,
                'text-halo-blur': 0.5,
              },
            });
          } catch {}
        }
      }

      // Click listener for route selection
      try {
        m.on('click', lineId, () => {
          if (onSelectRoute) onSelectRoute(route.id);
        });
        m.on('mouseenter', lineId, () => {
          m.getCanvas().style.cursor = 'pointer';
        });
        m.on('mouseleave', lineId, () => {
          if (!pinMode) m.getCanvas().style.cursor = '';
        });
      } catch {}

      if (isSelected) {
        route.coordinates.forEach((c) => {
          bounds.extend(c as [number, number]);
          hasCoords = true;
        });
      }
    });

    if (hasCoords) {
      m.fitBounds(bounds, { padding: 75, duration: 800 });
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
      let iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/></svg>`;
      if (navPosition.mode === 'running') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="17" cy="4" r="2"/><path d="m15 15 3-4-2-3-4 2-2 4 2 2"/><path d="m7 21 4-6"/><path d="M4 17l3-3"/></svg>`;
      } else if (navPosition.mode === 'biking') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>`;
      } else if (navPosition.mode === 'driving') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`;
      }

      el.style.cssText = `
        width: 34px; height: 34px; border-radius: 50%;
        background: #10B981; border: 2.5px solid white;
        box-shadow: 0 0 12px rgba(16, 185, 129, 0.7);
        display: flex; align-items: center; justify-content: center;
        transition: transform 0.25s ease-out;
        transform: rotate(${navPosition.bearing || 0}deg);
      `;
      el.innerHTML = iconSvg;

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
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
          Click map to set {pinMode === 'origin' ? 'Origin' : 'Destination'}
        </div>
      )}
    </div>
  );
};

export default Map;
