import { useState, useEffect, useCallback, useMemo } from 'react';
import Map, { type PinMode } from '../components/Map';
import LocationSearch, { type GeoResult } from '../components/LocationSearch';
import { planMission, checkBackendHealth, parseUserIntent, type BackendStatus } from '../services/api';
import type { MissionRequest, MissionResponse, ActivityType, PaceType, PlanningMode, ParsedIntent } from '../types/mission';


interface NamedCoord {
  lat: number;
  lng: number;
  name: string;
}

const ACTIVITIES: { id: ActivityType; label: string; icon: string; speedKmh: number }[] = [
  { id: 'driving', label: 'Drive', icon: '🚗', speedKmh: 35.0 },
  { id: 'biking', label: 'Bike', icon: '🚴', speedKmh: 16.0 },
  { id: 'running', label: 'Run', icon: '🏃', speedKmh: 10.0 },
  { id: 'walking', label: 'Walk', icon: '🚶', speedKmh: 5.0 },
];

const PACES: { id: PaceType; label: string }[] = [
  { id: 'slow', label: 'Relaxed' },
  { id: 'normal', label: 'Normal' },
  { id: 'fast', label: 'Fast' },
];

const AGENT_PRESETS = [
  { label: '🐕 Dog Walk in Shade', prompt: "I'm walking my dog in Lower Manhattan to the vet, dog's paws burn easily on hot asphalt" },
  { label: '🏃 Coolest 5k Run Path', prompt: "Running 5km in Lower Manhattan, want coolest shade path and hyperthermia prevention" },
  { label: '🚴 Relaxed Bike Trip', prompt: "Relaxed bike ride from Financial District to Lower East Side, avoid high heat avenues" },
];

export default function MapPage() {
  const [loading, setLoading] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState('');
  const [specialTags, setSpecialTags] = useState<string[]>([]);
  const [response, setResponse] = useState<MissionResponse | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('coolest');
  const [error, setError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({ online: false, url: null, port: null });

  // Planning Mode: Instant vs Scheduled
  const [planningMode, setPlanningMode] = useState<PlanningMode>('instant');
  const [deadlineHours, setDeadlineHours] = useState<number>(1);

  // Lower Manhattan defaults
  const [origin, setOrigin] = useState<NamedCoord>({ lat: 40.7080, lng: -74.0120, name: 'Lower Manhattan, New York' });
  const [dest, setDest] = useState<NamedCoord>({ lat: 40.7140, lng: -74.0060, name: 'Financial District, New York' });

  // Activity and Pace
  const [activity, setActivity] = useState<ActivityType>('driving');
  const [pace, setPace] = useState<PaceType>('normal');

  // Map pin mode
  const [pinMode, setPinMode] = useState<PinMode>(null);

  // Map Controls State: Map Style & Projection Mode
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite'>('standard');
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');

  // Calculate distance
  const distanceKm = useMemo(() => {
    const R = 6371;
    const dLat = (dest.lat - origin.lat) * (Math.PI / 180);
    const dLon = (dest.lng - origin.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(origin.lat * (Math.PI / 180)) *
        Math.cos(dest.lat * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, [origin, dest]);

  const currentActivityConfig = useMemo(() => {
    return ACTIVITIES.find((a) => a.id === activity) || ACTIVITIES[0];
  }, [activity]);

  const estimatedMinutes = useMemo(() => {
    const paceMult = pace === 'slow' ? 1.25 : pace === 'fast' ? 0.8 : 1.0;
    return Math.max(1, Math.round((distanceKm / currentActivityConfig.speedKmh) * 60 * paceMult));
  }, [distanceKm, currentActivityConfig, pace]);

  // Health check
  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      const status = await checkBackendHealth();
      if (!cancelled) setBackendStatus(status);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Gemini Intent Agent Parsing
  const handleParsePrompt = async (promptToParse: string) => {
    if (!promptToParse.trim()) return;
    setAgentLoading(true);
    setError(null);
    try {
      const res = await parseUserIntent(promptToParse);
      const intent: ParsedIntent = res.intent;
      if (intent) {
        if (intent.activity) setActivity(intent.activity);
        if (intent.pace) setPace(intent.pace);
        if (intent.special_profile_tags) setSpecialTags(intent.special_profile_tags);
        if (intent.deadline_minutes) {
          setPlanningMode('scheduled');
          setDeadlineHours(Math.max(1, Math.round(intent.deadline_minutes / 60)));
        }
      }
    } catch (err: any) {
      console.warn('Agent intent parsing warning:', err);
    } finally {
      setAgentLoading(false);
    }
  };

  const handleOriginSelect = (r: GeoResult) => {
    setOrigin({ lat: r.lat, lng: r.lng, name: r.display_name });
    setResponse(null);
    setError(null);
  };

  const handleDestSelect = (r: GeoResult) => {
    setDest({ lat: r.lat, lng: r.lng, name: r.display_name });
    setResponse(null);
    setError(null);
  };

  const handleMapClick = useCallback((lat: number, lng: number) => {
    const shortName = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    if (pinMode === 'origin') {
      setOrigin({ lat, lng, name: shortName });
    } else if (pinMode === 'destination') {
      setDest({ lat, lng, name: shortName });
    }
    setPinMode(null);
    setResponse(null);
    setError(null);
  }, [pinMode]);

  const handlePlan = async () => {
    if (!backendStatus.online) {
      setError('Backend is offline. Start it with ./start.sh.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const request: MissionRequest = {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: dest.lat, lng: dest.lng },
        planning_mode: planningMode,
        deadline_minutes: planningMode === 'scheduled' ? deadlineHours * 60 : estimatedMinutes + 15,
        activity,
        pace,
        prompt: agentPrompt || undefined,
        special_tags: specialTags
      };

      const result = await planMission(request);
      setResponse(result);

      if (result.route_options && result.route_options.length > 0) {
        const rec = result.route_options.find((r) => r.is_recommended) || result.route_options[0];
        setSelectedRouteId(rec.id);
      } else {
        setSelectedRouteId('recommended');
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.detail?.message ||
        err.response?.data?.detail ||
        err.message ||
        'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const decisionColor: Record<string, string> = {
    GO: '#10b981',
    WAIT: '#f59e0b',
    REROUTE: '#3b82f6',
    WAIT_AND_REROUTE: '#8b5cf6',
    'HIGH HEAT — BEST AVAILABLE PLAN': '#ef4444',
    'NO ROUTE': '#6b7280',
  };

  const activityVerb = useMemo(() => {
    switch (activity) {
      case 'running': return 'Run';
      case 'biking': return 'Ride';
      case 'driving': return 'Drive';
      default: return 'Walk';
    }
  }, [activity]);

  const activeRoute = useMemo(() => {
    if (!response?.route_options || response.route_options.length === 0) return null;
    return response.route_options.find((r) => r.id === selectedRouteId) || response.route_options[0];
  }, [response, selectedRouteId]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">

    

      {/* Main Layout Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Sidebar Controls & Results Panel */}
        <div className="w-full md:w-[450px] lg:w-[480px] bg-white border-r border-slate-200 h-full flex flex-col z-10 shadow-lg">
          
          {/* Header */}
          <div className="p-4 border-b border-slate-100 bg-white">
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">CoolPath</h1>
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                backendStatus.online 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${backendStatus.online ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {backendStatus.online ? `Port ${backendStatus.port}` : 'Backend Offline'}
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Heat-aware multi-modal mission planner — powered by FortyGuard & CoolPath Assistant.
            </p>
          </div>

          {/* Form Content - Scrollable area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* ✨ CoolPath Assistant Natural Language Prompt Bar */}
            <div className="p-3 bg-gradient-to-br from-sky-50 to-sky-100/60 border border-sky-200 rounded-xl shadow-xs">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-sky-700 flex items-center gap-1">
                  ✨ CoolPath Assistant Prompt Bar
                </span>
                {agentLoading && <span className="text-[11px] text-sky-600 animate-pulse">⏳ CoolPath parsing…</span>}
              </div>
              <div className="flex gap-1.5 mb-2">
                <input
                  type="text"
                  value={agentPrompt}
                  placeholder="e.g. Walking my dog to East Village, paws burn on hot asphalt..."
                  onChange={(e) => setAgentPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleParsePrompt(agentPrompt); }}
                  className="flex-1 px-2.5 py-2 text-xs bg-white border border-sky-300 rounded-lg outline-none focus:ring-2 focus:ring-sky-500/40 text-slate-700 placeholder-slate-400"
                />
                <button
                  type="button"
                  onClick={() => handleParsePrompt(agentPrompt)}
                  disabled={agentLoading || !agentPrompt.trim()}
                  className="px-3 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed"
                >
                  Parse
                </button>
              </div>
              
              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1">
                {AGENT_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setAgentPrompt(preset.prompt);
                      handleParsePrompt(preset.prompt);
                    }}
                    className="px-2 py-1 rounded-full bg-white border border-sky-200 text-sky-700 text-[11px] font-medium hover:bg-sky-50 transition cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Planning Mode Selector */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Planning Mode</label>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPlanningMode('instant')}
                  className={`flex-1 py-1.5 px-2 text-xs rounded-md transition duration-150 cursor-pointer font-medium ${
                    planningMode === 'instant' 
                      ? 'bg-white text-slate-900 font-bold shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ⚡ Depart Now (Instant)
                </button>
                <button
                  type="button"
                  onClick={() => setPlanningMode('scheduled')}
                  className={`flex-1 py-1.5 px-2 text-xs rounded-md transition duration-150 cursor-pointer font-medium ${
                    planningMode === 'scheduled' 
                      ? 'bg-white text-slate-900 font-bold shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ⏱ Scheduled / Deadline
                </button>
              </div>
            </div>

            {/* Scheduled Mode Deadline Slider */}
            {planningMode === 'scheduled' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <div className="flex justify-between text-xs text-slate-700 font-semibold">
                  <span>Target Arrival Window</span>
                  <span className="text-blue-600">Within {deadlineHours} {deadlineHours === 1 ? 'hour' : 'hours'}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="12"
                  step="1"
                  value={deadlineHours}
                  onChange={(e) => setDeadlineHours(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="text-[11px] text-slate-500 leading-tight">
                  CoolPath will scan multi-hour microclimate forecasts to tell you the optimal departure time.
                </div>
              </div>
            )}

            {/* Activity Selector */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Choose Activity</label>
              <div className="grid grid-cols-4 gap-1.5">
                {ACTIVITIES.map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => {
                      setActivity(act.id);
                      setResponse(null);
                    }}
                    disabled={loading}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs transition duration-150 cursor-pointer ${
                      activity === act.id
                        ? 'border-blue-500 bg-blue-50/50 text-blue-700 font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-base mb-0.5">{act.icon}</span>
                    <span>{act.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pace Selector */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Pace / Intensity</label>
              <div className="grid grid-cols-3 gap-1.5">
                {PACES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPace(p.id);
                      setResponse(null);
                    }}
                    disabled={loading}
                    className={`py-1.5 px-2 rounded-md border text-xs text-center transition duration-150 cursor-pointer font-medium ${
                      pace === p.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Special Profile Tags */}
            {specialTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-500 font-semibold">Active Agent Tags:</span>
                {specialTags.map((tag, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">
                    🏷 {tag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}

            {/* Origin & Destination */}
            <div className="space-y-2 ">
              <LocationSearch
                label="Origin"
                value={origin.name}
                onSelect={handleOriginSelect}
                pinColor="green"
                disabled={loading}
              />
              <LocationSearch
                label="Destination"
                value={dest.name}
                onSelect={handleDestSelect}
                pinColor="red"
                disabled={loading}
              />
            </div>

            {/* Map Pin Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPinMode((prev) => (prev === 'origin' ? null : 'origin'))}
                disabled={loading}
                className={`flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                  pinMode === 'origin'
                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>🟢</span>
                <span>{pinMode === 'origin' ? 'Tap map…' : 'Set Origin'}</span>
              </button>

              <button
                type="button"
                onClick={() => setPinMode((prev) => (prev === 'destination' ? null : 'destination'))}
                disabled={loading}
                className={`flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                  pinMode === 'destination'
                    ? 'bg-red-500 text-white border-red-600 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>🔴</span>
                <span>{pinMode === 'destination' ? 'Tap map…' : 'Set Destination'}</span>
              </button>
            </div>

            {/* Distance Badge */}
            <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 flex justify-between items-center">
              <span>📏 Distance: <strong>{distanceKm.toFixed(2)} km</strong></span>
              <span>⏱ ~{estimatedMinutes} min {activityVerb.toLowerCase()}</span>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed">
                ⚠️ {error}
              </div>
            )}

            {/* Submit Action Button */}
            <button
              onClick={handlePlan}
              disabled={loading || !backendStatus.online}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-md transition duration-150 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading 
                ? `⏳ Planning ${activity} trip…` 
                : !backendStatus.online 
                  ? '⚠ Backend Offline' 
                  : `🌡 Plan ${currentActivityConfig.label} Route`}
            </button>

            {/* Dynamic Results Display */}
            {response && (
              <div className="space-y-3 pt-2">
                
                {/* ⏱ Scheduled Departure Intelligence Card */}
                {response.planning_mode === 'scheduled' && response.wait_minutes > 0 && (
                  <div className="p-3.5 bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-300 rounded-xl text-amber-900">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 mb-1">
                      ⏱ Timing Strategy Recommendation
                    </div>
                    <h3 className="text-sm font-extrabold mb-1">
                      Optimal Departure: {response.optimal_departure_time || `+${response.wait_minutes} min`}
                    </h3>
                    <div className="text-xs leading-relaxed">
                      Delaying departure by <strong>{response.wait_minutes} minutes</strong> lets surface solar irradiance drop, saving an extra <strong>{response.thermal_reduction_percent}% heat strain</strong>.
                    </div>
                  </div>
                )}

                {/* 🌡 FortyGuard Multi-Dimensional Environmental Profile */}
                {response.env_summary && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      🌐 FortyGuard Environmental Profile
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                      <div>🌡 Apparent Heat: <strong>{response.env_summary.apparent_temp_c}°C</strong></div>
                      <div>☀️ Solar GHI: <strong>{response.env_summary.ghi_solar_w_m2} W/m²</strong></div>
                      <div>💨 Air Quality: <strong>{response.env_summary.air_quality_level}</strong></div>
                      <div>💧 Humidity: <strong>{response.env_summary.relative_humidity_pct}%</strong></div>
                    </div>
                  </div>
                )}

                {/* ✨ Gemini Agentic Mission Briefing Card */}
                {response.gemini_briefing && (
                  <div className="p-3.5 bg-gradient-to-br from-purple-50 to-purple-100/70 border border-purple-300 rounded-xl shadow-xs">
                    <div className="text-[11px] font-bold text-purple-700 uppercase tracking-wider mb-1">
                      ✨ CoolPath Assistant Mission Briefing
                    </div>
                    <h3 className="text-xs font-bold text-purple-900 mb-1">
                      {response.gemini_briefing.headline}
                    </h3>
                    <p className="text-xs text-purple-800 leading-relaxed mb-2">
                      {response.gemini_briefing.narrative}
                    </p>
                    {response.gemini_briefing.health_alert && (
                      <div className="p-2 mb-1 rounded bg-red-50 border border-red-200 text-[11px] font-semibold text-red-700">
                        {response.gemini_briefing.health_alert}
                      </div>
                    )}
                    {response.gemini_briefing.timing_advice && (
                      <div className="text-[11px] font-semibold text-sky-700">
                        {response.gemini_briefing.timing_advice}
                      </div>
                    )}
                  </div>
                )}

                {/* Decision Summary */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                  <div 
                    className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide"
                    style={{
                      backgroundColor: `${decisionColor[response.decision] || '#6b7280'}15`,
                      color: decisionColor[response.decision] || '#6b7280'
                    }}
                  >
                    {response.decision.replace(/_/g, ' ')}
                  </div>

                  {response.decision === 'WAIT_AND_REROUTE' && <div className="text-xs font-bold text-slate-800">Wait {response.wait_minutes} min + take cooler {activity} route</div>}
                  {response.decision === 'WAIT' && <div className="text-xs font-bold text-slate-800">Wait {response.wait_minutes} min before departing</div>}
                  {response.decision === 'REROUTE' && <div className="text-xs font-bold text-slate-800">Take the cooler alternate {activity} route</div>}
                  {response.decision === 'GO' && <div className="text-xs font-bold text-slate-800">Go now — direct {activity} route is optimal</div>}

                  {(() => {
                    const currentReduction = activeRoute ? activeRoute.thermal_reduction_percent : (response.thermal_reduction_percent || 0);
                    if (currentReduction > 0) {
                      return (
                        <div>
                          <div className="text-2xl font-extrabold text-emerald-500">{currentReduction}%</div>
                          <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">LESS ESTIMATED HEAT EXPOSURE</div>
                        </div>
                      );
                    } else {
                      return (
                        <div>
                          <div className="text-xl font-bold text-blue-500 tracking-tight">OPTIMAL</div>
                          <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                            DIRECT PATH HAS LOWEST TRAVEL TIME & MINIMAL HEAT STRAIN (~{activeRoute?.avg_temp_c || 32.4}°C)
                          </div>
                        </div>
                      );
                    }
                  })()}

                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-600 leading-relaxed">
                    <strong className="text-slate-800 block mb-1">
                      Why this route for {currentActivityConfig.label}?
                    </strong>
                    {activeRoute?.explanation || response.explanation}
                  </div>
                </div>

                {/* Interactive Multi-Route Cards Selector */}
                {response.route_options && response.route_options.length > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Available Routes (Click to Compare)
                    </h3>
                    <div className="space-y-1.5">
                      {response.route_options.map((route) => {
                        const isSelected = route.id === selectedRouteId;
                        return (
                          <div
                            key={route.id}
                            onClick={() => setSelectedRouteId(route.id)}
                            className={`p-3 rounded-lg border transition cursor-pointer ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50/40 shadow-xs'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className={`text-xs font-bold ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                                {route.name}
                              </span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                route.is_recommended ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {route.tag}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500">
                              <span>⏱ {route.travel_minutes} min {activityVerb.toLowerCase()}</span>
                              <span>🌡 ~{route.avg_temp_c}°C avg</span>
                              {route.thermal_reduction_percent > 0 ? (
                                <span className="text-emerald-600 font-semibold">{route.thermal_reduction_percent}% Cooler</span>
                              ) : (
                                <span>Baseline</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Comparison Metrics */}
                {response.comparison && (
                  <div className="overflow-hidden border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2">Metric</th>
                          <th className="p-2">Fastest</th>
                          <th className="p-2 bg-blue-50 text-blue-700">Selected Path</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="p-2 font-medium">{activityVerb} time</td>
                          <td className="p-2">{response.comparison.fastest.travel_minutes} min</td>
                          <td className="p-2 bg-blue-50/50 font-semibold text-slate-800">
                            {activeRoute ? activeRoute.travel_minutes : response.comparison.recommended.travel_minutes} min
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2 font-medium">Avg Temperature</td>
                          <td className="p-2">~33.5°C</td>
                          <td className="p-2 bg-blue-50/50 font-semibold text-slate-800">
                            {activeRoute ? `~${activeRoute.avg_temp_c}°C` : '~31.8°C'}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2 font-medium">Wait time</td>
                          <td className="p-2">0 min</td>
                          <td className="p-2 bg-blue-50/50 font-semibold text-slate-800">{response.wait_minutes} min</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-medium">Thermal score</td>
                          <td className="p-2">{response.comparison.fastest.thermal_exposure}</td>
                          <td className="p-2 bg-blue-50/50 font-semibold text-slate-800">
                            {activeRoute ? activeRoute.thermal_exposure : response.comparison.recommended.thermal_exposure}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>

        {/* Dynamic Map Container & Map Mode Controls */}
        <div className="flex-1 h-full relative">
          
          {/* Floating Map Mode Control Bar (Normal/Satellite View & 2D/3D Mode) */}
          <div className="absolute top-4 right-4 z-20 flex bg-white/90 backdrop-blur-md p-1 rounded-xl shadow-lg border border-slate-200/80 gap-1 text-xs">
            {/* View Mode: Normal Map vs Satellite */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setMapStyle('standard')}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  mapStyle === 'standard'
                    ? 'bg-white text-slate-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                🗺️ Standard
              </button>
              <button
                type="button"
                onClick={() => setMapStyle('satellite')}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  mapStyle === 'satellite'
                    ? 'bg-white text-slate-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                🛰️ Satellite
              </button>
            </div>

            <div className="w-[1px] bg-slate-200 my-1" />

            {/* Projection Mode: 2D vs 3D View */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('2D')}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  viewMode === '2D'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                2D
              </button>
              <button
                type="button"
                onClick={() => setViewMode('3D')}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  viewMode === '3D'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                3D
              </button>
            </div>
          </div>

          {/* Interactive Map Leaflet / Mapbox Component Container */}
          <div className="w-full h-full">
            <Map
              missionResponse={response}
              originCoord={origin}
              destinationCoord={dest}
              pinMode={pinMode}
              onMapClick={handleMapClick}
              selectedRouteId={selectedRouteId}
              onSelectRoute={(id) => setSelectedRouteId(id)}
              // Passing newly added map controls to the child component
              mapStyle={mapStyle}
              viewMode={viewMode}
            />
          </div>
        </div>

      </div>
    </div>
  );
}