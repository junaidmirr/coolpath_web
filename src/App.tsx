<<<<<<< Updated upstream
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import MapPage from './pages/MapPage';
import History from './pages/History';
import Assistant from './pages/Assistant';
import SettingsPage from './pages/SettingsPage';
=======
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Map, { type PinMode } from './components/Map';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import {
  planMission,
  checkBackendHealth,
  submitRouteFeedback,
  fetchMLStats,
  fetchSmartSearchSuggestions,
  type BackendStatus,
} from './services/api';
import type {
  MissionRequest,
  MissionResponse,
  ActivityType,
  PaceType,
  PlanningMode,
  Coordinate,
  HistoryItem,
  PlaceSuggestion,
} from './types/mission';
import {
  Map as MapIcon, History, Sparkles, Settings, X, Trash2, Mic,
  Thermometer, Wind, Navigation, Layers, ChevronUp, ChevronDown,
  ChevronRight, Zap, Clock, Car, Bike, Footprints, Flame,
  MapPin, ThumbsUp, ThumbsDown, Play, Info, Shield, Brain,
  TrendingDown, Hourglass, Gauge, AlertTriangle, Sun, Droplets,
  ArrowUpDown, Leaf, Snowflake, Scale, LocateFixed, Square,
  Plus, Minus, Target, BarChart3, CheckCircle, Trophy,
  FileText, Lock, FlaskConical, Compass, Box
} from 'lucide-react';
import logoDark from './assets/logo_dark.png';
import logoLight from './assets/logo_light.png';
import './index.css';
>>>>>>> Stashed changes

// ── Constants ────────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = (import.meta as any).env?.VITE_MAPBOX_TOKEN ||
  'pk.eyJ1IjoianVuYWlkbWlyMDUxIiwiYSI6ImNtc3l0MWFwNjAzMmsyenNrbW1mMjI0aHcifQ.j8_w_jQUiv26L8QYQVSBVA';

<<<<<<< Updated upstream


function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Navbar সবসময় উপরে থাকবে */}
      <Navbar />

      {/* URL অনুযায়ী নিচের পেজগুলো লোড হবে */}
      <main className="p-4">
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/history" element={<History />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
=======
const ACTIVITIES: { id: ActivityType; label: string; icon: any; speedKmh: number }[] = [
  { id: 'walking', label: 'Walk', icon: Footprints, speedKmh: 5 },
  { id: 'running', label: 'Run', icon: Flame, speedKmh: 10 },
  { id: 'biking', label: 'Bike', icon: Bike, speedKmh: 18 },
  { id: 'driving', label: 'Drive', icon: Car, speedKmh: 45 },
];

const PACES: { id: PaceType; label: string }[] = [
  { id: 'slow', label: 'Relaxed' },
  { id: 'normal', label: 'Normal' },
  { id: 'fast', label: 'Paced' },
];

const DEADLINE_OPTIONS = [15, 30, 45, 60, 90];

const CRAFTING_STEPS = [
  'Scanning FortyGuard urban microclimate sensors...',
  'Mapping shaded side streets & tree canopies...',
  'Calculating real-feel thermal exposure metrics...',
  'Selecting cool corridors with lowest heat strain...',
  'CoolPath Assistant synthesizing safety briefing...',
  'Finalizing your optimal CoolPath route...',
];

const AI_PRESETS = [
  { label: 'Dog Walk in Shade', prompt: 'Walking my dog, paws burn on hot asphalt, prioritize shade' },
  { label: 'Coolest 5k Run', prompt: 'Running 5km, want shaded park corridor, avoid direct solar heat' },
  { label: 'Bike Commute', prompt: 'Relaxed bike trip, avoid high heat avenues' },
];

const ROUTE_COLORS: Record<string, string> = {
  coolest: '#10B981',
  fastest: '#64748B',
  route_1: '#3B82F6',
  route_2: '#8B5CF6',
  route_3: '#F59E0B',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseCoordString(q: string): Coordinate | null {
  if (!q) return null;
  const clean = q.replace(/[[\]()]/g, '').trim();
  const m = clean.match(/^([-+]?\d+(?:\.\d+)?)\s*[,;\s]\s*([-+]?\d+(?:\.\d+)?)$/);
  if (m) {
    const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)
      return { lat, lng };
  }
  return null;
}

async function geocode(q: string, fallback?: Coordinate): Promise<Coordinate | null> {
  if (!q?.trim()) return fallback || null;
  const direct = parseCoordString(q);
  if (direct) return direct;
  try {
    const r = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q.trim())}.json?access_token=${MAPBOX_TOKEN}&limit=1`
    );
    const d = await r.json();
    if (d.features?.length) {
      const [lng, lat] = d.features[0].center;
      return { lat, lng };
    }
  } catch {}
  return fallback || null;
}

async function fetchPlaceSuggestions(query: string, userOrigin?: Coordinate): Promise<PlaceSuggestion[]> {
  if (!query || query.trim().length < 2) return [];
  if (parseCoordString(query)) return [];
  if (userOrigin) {
    try {
      const results = await fetchSmartSearchSuggestions(query, userOrigin.lat, userOrigin.lng);
      if (results?.length) {
        return results.map((r: any) => ({
          id: r.id, placeName: r.place_name, shortName: r.short_name,
          lat: r.lat, lng: r.lng, distanceKm: r.distance_km,
          ring: r.ring, badgeLabel: r.badge_label, reasoning: r.reasoning,
        }));
      }
    } catch {}
  }
  try {
    const prox = userOrigin ? `&proximity=${userOrigin.lng},${userOrigin.lat}` : '';
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query.trim())}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5${prox}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.features?.length) {
      return data.features.map((f: any) => ({
        id: f.id, placeName: f.place_name, shortName: f.text || f.place_name,
        lat: f.center[1], lng: f.center[0],
      }));
    }
  } catch {}
  return [];
}

function calcDistKm(a: Coordinate, b: Coordinate): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x)) * 10) / 10;
}

interface LiveWeather { tempC: number|null; aqi: number|null; humidity: number|null; windSpeedKmh: number|null; }
async function fetchLiveWeather(lat: number, lng: number): Promise<LiveWeather> {
  try {
    const [wRes, aRes] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m`),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi`),
    ]);
    const wData = await wRes.json(), aData = await aRes.json();
    return {
      tempC: wData.current?.temperature_2m != null ? Math.round(wData.current.temperature_2m) : null,
      aqi: aData.current?.us_aqi != null ? Math.round(aData.current.us_aqi) : null,
      humidity: wData.current?.relative_humidity_2m != null ? Math.round(wData.current.relative_humidity_2m) : null,
      windSpeedKmh: wData.current?.wind_speed_10m != null ? Math.round(wData.current.wind_speed_10m) : null,
    };
  } catch { return { tempC: null, aqi: null, humidity: null, windSpeedKmh: null }; }
}

// Maya dialogue pool
const MAYA_POOL: Record<string, string[]> = {
  start: [
    "Hey there, Maya here! All geared up for our trip. Let's keep it breezy and beat the heat!",
    "Maya reporting! Sun, prepare to be completely avoided!",
    "Alright, Maya is on the move! Time to find that sweet shade!",
  ],
  cool: [
    "Ooh yes, feel that cool breeze! We just entered a shaded pocket. My sunscreen can take a break!",
    "Maya's official route review: this canopy is absolute perfection. Urban trees doing wonders!",
    "Microclimate jackpot! Temperature dropped here. Loving this chill vibe!",
  ],
  heat: [
    "Holy sunshine! Temp spiked right here. Powering through to dodge this heat pocket!",
    "Whew, the asphalt is glowing hot. Good thing our cool path takes us back to shade soon!",
    "Entering a warm zone! Stay hydrated — Maya is briskly passing this sun trap!",
  ],
  journey: [
    "Halfway mark! 50% completed and we're cruising comfortably!",
    "Midway check-in with Maya! Heart rate steady, shade level ten out of ten.",
    "50% through our route! We've bypassed the city's worst heat islands. High five!",
  ],
  arrival: [
    "Boom! Destination reached! We made it looking fresh and cool, thanks to CoolPath. Maya signing off!",
    "Touchdown! Zero sunburn, maximum cool vibes. That was a legendary route!",
    "We arrived! Maya survived, thrived, and stayed cool. As refreshing as an iced matcha latte!",
  ],
};
function getMayaDialogue(type: string): string {
  const pool = MAYA_POOL[type] || MAYA_POOL.journey;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  // ── Theme ─────────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(true);
  const theme = useMemo(() => isDark ? {
    isDark: true,
    bg: '#0C1210', topCardBg: 'rgba(21,31,27,0.97)', sheetBg: '#151F1B',
    surfaceInset: '#1E2A24', textPrimary: '#F3F0EA', textSecondary: '#A8A296',
    textMuted: '#6B6659', border: 'rgba(240,237,228,0.08)', borderStrong: 'rgba(240,237,228,0.16)',
    inputBg: '#1E2A24', accentCool: '#2DD9B8', accentHeat: '#E8895E',
    accentFast: '#7C93B0', accentBalanced: '#C9A468', accentGold: '#E0B84A',
    statusOnline: '#2DD9B8', statusOffline: '#E8895E',
    mapStyle: 'dark' as const,
  } : {
    isDark: false,
    bg: '#F6F3EC', topCardBg: 'rgba(255,255,255,0.97)', sheetBg: '#FFFFFF',
    surfaceInset: '#EDE8DC', textPrimary: '#191712', textSecondary: '#5C574B',
    textMuted: '#8C8676', border: 'rgba(20,18,14,0.08)', borderStrong: 'rgba(20,18,14,0.16)',
    inputBg: '#EDE8DC', accentCool: '#0E9E86', accentHeat: '#C2603A',
    accentFast: '#566E8C', accentBalanced: '#A37E43', accentGold: '#C49B28',
    statusOnline: '#0E9E86', statusOffline: '#C2603A',
    mapStyle: 'light' as const,
  }, [isDark]);

  // ── Tabs / UI ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'map' | 'history' | 'ai'>('map');
  const [uiVisible] = useState(true);

  // ── Backend ────────────────────────────────────────────────────────────────
  const [backend, setBackend] = useState<BackendStatus>({ online: false, url: null, port: null });
  const [isRetrying, setIsRetrying] = useState(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    const ping = async () => { const s = await checkBackendHealth(); if (!dead) setBackend(s); };
    ping();
    const iv = setInterval(ping, 15000);
    return () => { dead = true; clearInterval(iv); };
  }, []);

  // ── Settings ────────────────────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');
  const [distUnit, setDistUnit] = useState<'km' | 'mi'>('km');
  const [shadeWeight, setShadeWeight] = useState<'comfort' | 'balanced' | 'strict'>('balanced');
  const [defaultPace, setDefaultPace] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [heatAlertsOn, setHeatAlertsOn] = useState(true);
  const [defaultDepartMode, setDefaultDepartMode] = useState<'now' | 'scheduled'>('now');
  const [showAbout, setShowAbout] = useState<'about' | 'terms' | 'privacy' | 'science' | null>(null);
  const [customBackendUrl, setCustomBackendUrl] = useState(() => localStorage.getItem('custom_backend_url') || '');

  // ── Location & Route ────────────────────────────────────────────────────────
  const [origin, setOrigin] = useState<Coordinate>({ lat: 40.7580, lng: -73.9855 });
  const [dest, setDest] = useState<Coordinate>({ lat: 40.7812, lng: -73.9665 });
  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState('');
  const [isDestSelected, setIsDestSelected] = useState(false);
  const [pinMode, setPinMode] = useState<PinMode>(null);
  const [flyTo, setFlyTo] = useState<Coordinate | null>(null);

  // ── Search suggestions ──────────────────────────────────────────────────────
  const [activeSearch, setActiveSearch] = useState<'origin' | 'dest' | null>(null);
  const [originSuggestions, setOriginSuggestions] = useState<PlaceSuggestion[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<PlaceSuggestion[]>([]);
  const [suggestedPlaces, setSuggestedPlaces] = useState<string[]>(['Central Park', 'Times Square', 'Brooklyn Bridge', 'High Line Park']);

  useEffect(() => {
    if (!originText || originText.trim().length < 2 || activeSearch !== 'origin') {
      setOriginSuggestions([]); return;
    }
    const t = setTimeout(async () => {
      const r = await fetchPlaceSuggestions(originText, origin);
      setOriginSuggestions(r);
    }, 220);
    return () => clearTimeout(t);
  }, [originText, activeSearch, origin]);

  useEffect(() => {
    if (!destText || destText.trim().length < 2 || activeSearch !== 'dest') {
      setDestSuggestions([]); return;
    }
    const t = setTimeout(async () => {
      const r = await fetchPlaceSuggestions(destText, origin);
      setDestSuggestions(r);
    }, 220);
    return () => clearTimeout(t);
  }, [destText, activeSearch, origin]);

  // ── Live Weather ────────────────────────────────────────────────────────────
  const [liveWeather, setLiveWeather] = useState<LiveWeather>({ tempC: null, aqi: null, humidity: null, windSpeedKmh: null });
  useEffect(() => {
    let dead = false;
    fetchLiveWeather(origin.lat, origin.lng).then(r => { if (!dead) setLiveWeather(r); });
    return () => { dead = true; };
  }, [origin.lat, origin.lng]);

  const directDistKm = useMemo(() => calcDistKm(origin, dest), [origin, dest]);

  // ── Activity / Pace / Planning ──────────────────────────────────────────────
  const [activity, setActivity] = useState<ActivityType>('walking');
  const [pace, setPace] = useState<PaceType>('normal');
  const [planMode, setPlanMode] = useState<PlanningMode>('instant');
  const [deadlineMinutes, setDeadlineMinutes] = useState(30);

  // ── Route Planning ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<MissionResponse | null>(null);
  const [selectedRoute, setSelectedRoute] = useState('coolest');
  const [error, setError] = useState<string | null>(null);
  const [isCrafting, setIsCrafting] = useState(false);
  const [craftStep, setCraftStep] = useState(0);
  const [showPlanSetup, setShowPlanSetup] = useState(false);

  useEffect(() => {
    if (!isCrafting) { setCraftStep(0); return; }
    const iv = setInterval(() => setCraftStep(p => (p + 1) % CRAFTING_STEPS.length), 1500);
    return () => clearInterval(iv);
  }, [isCrafting]);

  // ── ML ──────────────────────────────────────────────────────────────────────
  const [shadePreferencePct, setShadePreferencePct] = useState(65.0);
  const [mlHistory, setMlHistory] = useState<any[]>([]);
  const [showMLInsights, setShowMLInsights] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [ratedRoutes, setRatedRoutes] = useState<Record<string, 'good' | 'bad'>>({});

  const handleFeedback = async (routeId: string, satisfied: boolean) => {
    setRatedRoutes(p => ({ ...p, [routeId]: satisfied ? 'good' : 'bad' }));
    try {
      const res = await submitRouteFeedback(routeId, satisfied, {
        temp_c: liveWeather.tempC, activity, hour: new Date().getHours()
      });
      if (typeof res.shade_preference_percentage === 'number') setShadePreferencePct(res.shade_preference_percentage);
      setFeedbackToast(satisfied ? 'Positive feedback saved! ML Model updated.' : 'Preference noted! Reranking options.');
      setTimeout(() => setFeedbackToast(null), 3200);
      const stats = await fetchMLStats();
      if (stats?.history) setMlHistory(stats.history);
    } catch {}
  };

  // ── Navigation Simulation ───────────────────────────────────────────────────
  const [isNavigating, setIsNavigating] = useState(false);
  const [navPosition, setNavPosition] = useState<{ lat: number; lng: number; bearing?: number; mode?: string } | null>(null);
  const [navProgressPct, setNavProgressPct] = useState(0);
  const [navSpeedKmh, setNavSpeedKmh] = useState(0);
  const [navCurrentTempC, setNavCurrentTempC] = useState(25);
  const [navSpeakerText, setNavSpeakerText] = useState<string | null>(null);
  const [typedSubtitle, setTypedSubtitle] = useState('');
  const [commuterBodyTemp, setCommuterBodyTemp] = useState(37.0);
  const [acOn, setAcOn] = useState(true);
  const [simSpeedKmh, setSimSpeedKmh] = useState(12);
  const [navMode, setNavMode] = useState<'real' | 'simulated'>('simulated');
  const [showNavSetup, setShowNavSetup] = useState(false);
  const [showJourneySummary, setShowJourneySummary] = useState(false);
  const [journeyDuration, setJourneyDuration] = useState(0);
  const simIntervalRef = useRef<any>(null);
  const simSpeedRef = useRef(12);
  useEffect(() => { simSpeedRef.current = simSpeedKmh; }, [simSpeedKmh]);
  const acOnRef = useRef(true);
  useEffect(() => { acOnRef.current = acOn; }, [acOn]);

  // Typewriter for maya subtitles
  useEffect(() => {
    if (!navSpeakerText) { setTypedSubtitle(''); return; }
    let i = 0; let current = '';
    const timer = setInterval(() => {
      if (i < navSpeakerText.length) {
        current += navSpeakerText[i++];
        setTypedSubtitle(current);
      } else {
        clearInterval(timer);
        setTimeout(() => setTypedSubtitle(''), 4000);
      }
    }, 30);
    return () => clearInterval(timer);
  }, [navSpeakerText]);

  const speakText = (text: string) => {
    const clean = text.replace(/[*_~`#>-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!clean) return;
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(clean);
        u.rate = 1.1; u.lang = 'en-US';
        window.speechSynthesis.speak(u);
      }
    } catch {}
    // Also try StreamElements TTS
    try {
      const audio = new Audio(`https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(clean)}`);
      audio.volume = 0.85;
      audio.play().catch(() => {});
    } catch {}
  };

  const activeRoute = useMemo(() => {
    if (!response?.route_options?.length) return null;
    return response.route_options.find(r => r.id === selectedRoute) || response.route_options[0];
  }, [response, selectedRoute]);

  const stopNavigation = () => {
    setIsNavigating(false);
    setNavPosition(null);
    setNavSpeakerText(null);
    setTypedSubtitle('');
    setNavProgressPct(0);
    setCommuterBodyTemp(37.0);
    setSimSpeedKmh(12);
    setJourneyDuration(0);
    try { window.speechSynthesis?.cancel(); } catch {}
    if (simIntervalRef.current) { clearInterval(simIntervalRef.current); simIntervalRef.current = null; }
  };

  const adjustSimSpeed = (dir: 'up' | 'down') => {
    let min = 2, max = 8, step = 1;
    if (activity === 'running') { min = 5; max = 22; }
    else if (activity === 'biking') { min = 10; max = 45; step = 2; }
    else if (activity === 'driving') { min = 20; max = 140; step = 10; }
    setSimSpeedKmh(p => dir === 'up' ? Math.min(max, p + step) : Math.max(min, p - step));
  };

  const startNavigation = (mode: 'real' | 'simulated') => {
    stopNavigation();
    setShowNavSetup(false);
    setNavMode(mode);
    setIsNavigating(true);
    if (!activeRoute) return;

    const gTemps: [number, number, number][] = activeRoute.coordinates.map(
      (c: any) => [c[0], c[1], activeRoute.avg_temp_c || 28]
    );

    if (mode === 'real') {
      const msg = `Starting real-time GPS navigation on ${activity}. Have a safe journey!`;
      setNavSpeakerText(msg);
      speakText(msg);
      if (navigator.geolocation) {
        navigator.geolocation.watchPosition(pos => {
          setNavPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, bearing: pos.coords.heading || 0, mode: activity });
        });
      }
      return;
    }

    // Simulated Maya mode
    let stepIdx = 0;
    const totalSteps = gTemps.length;
    const startMsg = getMayaDialogue('start');
    setNavSpeakerText(startMsg);
    speakText(startMsg);
    const speedMap: Record<ActivityType, number> = { walking: 5, running: 10, biking: 18, driving: 45 };
    const defSpeed = speedMap[activity] || 12;
    setNavSpeedKmh(defSpeed);
    setSimSpeedKmh(defSpeed);
    let lastMilestone = -1, lastSpokenTemp = -1;

    simIntervalRef.current = setInterval(() => {
      if (stepIdx >= totalSteps) {
        clearInterval(simIntervalRef.current);
        const endMsg = getMayaDialogue('arrival');
        setNavSpeakerText(endMsg);
        speakText(endMsg);
        setNavProgressPct(100);
        setShowJourneySummary(true);
        setIsNavigating(false);
        return;
      }
      setJourneyDuration(p => p + 1);
      const curr = gTemps[stepIdx];
      const next = gTemps[Math.min(totalSteps - 1, stepIdx + 1)];
      const lng = curr[0], lat = curr[1], tempC = Math.round(curr[2]);
      const dx = (next[0] - curr[0]) * Math.cos((curr[1] + next[1]) * Math.PI / 360);
      const dy = next[1] - curr[1];
      const bearing = Math.abs(dx) > 0.000001 || Math.abs(dy) > 0.000001
        ? (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360 : 0;
      const pct = Math.round(stepIdx / Math.max(1, totalSteps - 1) * 100);
      setNavProgressPct(pct);
      setNavCurrentTempC(tempC);
      setNavSpeedKmh(simSpeedRef.current);
      setNavPosition({ lat, lng, bearing, mode: activity });

      // Thermodynamic body temp simulation
      setCommuterBodyTemp(prevT => {
        const dt = 1, m = 70, c = 3470, A = 1.8;
        const speed = simSpeedRef.current;
        let MET = 1.3, eta = 0.23;
        if (activity === 'walking') { MET = 1.5 + 0.4*speed; }
        else if (activity === 'running') { MET = 2.0 + 0.7*speed; }
        else if (activity === 'biking') { MET = 2.0 + 0.25*speed; }
        else { MET = 1.3; eta = 0; }
        const T_air_eff = activity === 'driving' ? (acOnRef.current ? 22 : tempC + 4) : tempC;
        const RH = liveWeather.humidity || 55;
        const v_air = activity === 'driving' ? (acOnRef.current ? 1.0 : 1.5) : ((liveWeather.windSpeedKmh || 8)/3.6 + speed/3.6);
        const Q_meta = MET * 58.2 * A * (1 - eta);
        let T_skin = Math.max(31, Math.min(36, 30 + 0.15*prevT + 0.1*T_air_eff));
        const h_c = Math.max(3, 8.6 * Math.pow(v_air, 0.6));
        const Q_C = h_c * A * (T_skin - T_air_eff);
        const Q_R = 4.7 * A * (T_skin - (T_air_eff + (activity === 'driving' ? 0 : 2)));
        const S = Math.min(0.00055, 0.00005 + 0.0004 * Math.max(0, prevT - 37) + 0.0002 * (MET - 1.3));
        const h_e = 16.5 * h_c;
        const P_sk = 0.1333 * Math.exp(18.6686 - 4030.18 / (T_skin + 235));
        const P_a = 0.1333 * Math.exp(18.6686 - 4030.18 / (T_air_eff + 235)) * (RH/100);
        const Q_E = Math.min(S * 2400000, Math.max(10, h_e * A * (P_sk - P_a)));
        const Q_stored = Q_meta - Q_C - Q_R - Q_E;
        return Math.max(36, Math.min(41, prevT + (Q_stored / (m * c)) * dt));
      });

      // Maya commentary
      const isMid = pct >= 45 && pct <= 55 && lastMilestone < 50;
      const isThermal = (tempC <= 23 || tempC >= 34) && lastSpokenTemp !== tempC && pct > 15 && pct < 85;
      if (stepIdx > 0 && stepIdx < totalSteps - 1 && (isMid || isThermal)) {
        if (isMid) lastMilestone = 50;
        lastSpokenTemp = tempC;
        const t = tempC <= 24 ? 'cool' : tempC >= 34 ? 'heat' : 'journey';
        const msg = getMayaDialogue(t);
        setNavSpeakerText(msg);
        speakText(msg);
      }

      const ratio = simSpeedRef.current / (speedMap[activity] || 5);
      stepIdx += Math.max(1, Math.round(ratio));
    }, 1000);
  };

  // ── Route Planning ──────────────────────────────────────────────────────────
  const [historyList, setHistoryList] = useState<HistoryItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('coolpath_history') || '[]'); } catch { return []; }
  });

  const saveHistory = useCallback((item: HistoryItem) => {
    setHistoryList(prev => {
      const updated = [item, ...prev.filter(h => h.id !== item.id)].slice(0, 30);
      try {
        localStorage.setItem('coolpath_history', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save route to localStorage:', e);
      }
      return updated;
    });
  }, []);

  const handleExecutePlan = async () => {
    setShowPlanSetup(false);
    if (!backend.online) { setError('Backend is offline. Please check connection.'); return; }
    setIsCrafting(true); setLoading(true); setError(null); setPinMode(null);
    try {
      const req: MissionRequest = {
        origin, destination: dest, planning_mode: planMode,
        deadline_minutes: planMode === 'scheduled' ? deadlineMinutes : 60,
        activity, pace,
      };
      const res = await planMission(req);
      if (!res.route_options?.length && (!res.routes?.fastest?.length || res.routes.fastest.length < 2)) {
        setError('Could not find routes. Please verify the locations and try again.');
        return;
      }
      setResponse(res);
      if (res.route_options?.length) {
        const rec = res.route_options.find(r => r.is_recommended) || res.route_options[0];
        setSelectedRoute(rec.id);
      }
      const item: HistoryItem = {
        id: `hist_${Date.now()}`, timestamp: Date.now(),
        originText: originText.trim() || `${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`,
        destText: destText.trim() || `${dest.lat.toFixed(4)}, ${dest.lng.toFixed(4)}`,
        originCoord: origin, destCoord: dest,
        activity, pace, planningMode: planMode, response: res,
        selectedRouteId: res.route_options?.[0]?.id || 'coolest',
      } as any;
      saveHistory(item);
    } catch (e: any) {
      setError(e.message || 'Route calculation failed');
    } finally {
      setIsCrafting(false); setLoading(false);
    }
  };

  const handleDiscardJourney = () => {
    if (!window.confirm('Discard this planned route and clear the map?')) return;
    setResponse(null); setError(null); setDestText(''); setOriginText(''); setIsDestSelected(false);
  };

  // ── 3D & Map Controls ───────────────────────────────────────────────────────
  const [is3D, setIs3D] = useState(false);
  const [mapBearing, setMapBearing] = useState(0);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setStatusToast('GPS is not supported by your browser.');
      setTimeout(() => setStatusToast(null), 3000);
      return;
    }
    setIsFetchingLocation(true);
    setStatusToast('Fetching GPS position...');

    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const coord = { lat, lng };
        setOrigin(coord);
        setOriginText('Current Location');
        setFlyTo(coord);
        setResponse(null);
        setIsFetchingLocation(false);
        setStatusToast('Updated to Current GPS Location');
        setTimeout(() => setStatusToast(null), 2500);
      },
      err => {
        setIsFetchingLocation(false);
        let msg = 'GPS location request denied or unavailable.';
        if (err.code === err.PERMISSION_DENIED) msg = 'Location access denied by user.';
        setStatusToast(msg);
        setTimeout(() => setStatusToast(null), 3500);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // ── Voice Assistant ─────────────────────────────────────────────────────────
  const [showAssistant, setShowAssistant] = useState(false);

  const handlePlanRouteAction = useCallback(async (oText: string, dText: string, act?: string, paceArg?: string, modeArg?: string) => {
    setActiveTab('map');
    setOriginText(oText); setDestText(dText);
    if (act && ['walking', 'running', 'biking', 'driving'].includes(act)) setActivity(act as ActivityType);
    if (paceArg && ['slow', 'normal', 'fast'].includes(paceArg)) setPace(paceArg as PaceType);
    if (modeArg && ['instant', 'scheduled'].includes(modeArg)) setPlanMode(modeArg as PlanningMode);
    let o = origin, d = dest;
    const dO = parseCoordString(oText);
    if (dO) { o = dO; setOrigin(dO); }
    else if (oText) { const oc = await geocode(oText, origin); if (oc) { o = oc; setOrigin(oc); } }
    const dD = parseCoordString(dText);
    if (dD) { d = dD; setDest(dD); }
    else if (dText) { const dc = await geocode(dText, dest); if (dc) { d = dc; setDest(dc); } }
    setIsDestSelected(true);
    setIsCrafting(true); setLoading(true); setError(null);
    try {
      const req: MissionRequest = { origin: o, destination: d, planning_mode: planMode, deadline_minutes: 60, activity: act as ActivityType || activity, pace };
      const res = await planMission(req);
      setResponse(res);
      if (res.route_options?.length) { const rec = res.route_options.find(r => r.is_recommended) || res.route_options[0]; setSelectedRoute(rec.id); }
      const item: HistoryItem = {
        id: `hist_${Date.now()}`, timestamp: Date.now(),
        originText: oText.trim() || `${o.lat.toFixed(4)}, ${o.lng.toFixed(4)}`,
        destText: dText.trim() || `${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}`,
        originCoord: o, destCoord: d,
        activity: act as ActivityType || activity, pace, planningMode: planMode, response: res,
        selectedRouteId: res.route_options?.[0]?.id || 'coolest',
      } as any;
      saveHistory(item);
    } catch (e: any) { setError(e.message || 'Route planning failed'); }
    finally { setIsCrafting(false); setLoading(false); }
  }, [origin, dest, activity, pace, planMode, saveHistory]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const formatTemp = (c: number | null | undefined) => {
    if (c == null) return '--';
    return tempUnit === 'F' ? `${Math.round(c * 9/5 + 32)}°F` : `${Math.round(c)}°C`;
  };
  const formatDist = (km: number | null) => {
    if (km == null) return '--';
    return distUnit === 'mi' ? `${(km * 0.621371).toFixed(1)} mi` : `${km.toFixed(1)} km`;
  };

  const handleRestoreHistory = (item: any) => {
    setOrigin(item.originCoord); setDest(item.destCoord);
    setOriginText(item.originText || `${item.originCoord.lat.toFixed(4)}, ${item.originCoord.lng.toFixed(4)}`);
    setDestText(item.destText || `${item.destCoord.lat.toFixed(4)}, ${item.destCoord.lng.toFixed(4)}`);
    setActivity(item.activity); setPace(item.pace);
    setPlanMode(item.planningMode); setResponse(item.response);
    setSelectedRoute(item.selectedRouteId); setIsDestSelected(true);
    setActiveTab('map');
  };

  const handleRetryBackend = async () => {
    if (isRetrying) return;
    if (backend.online) { setStatusToast('Connected'); setTimeout(() => setStatusToast(null), 2000); return; }
    setIsRetrying(true); setStatusToast('Connecting...');
    const res = await checkBackendHealth();
    setBackend(res); setIsRetrying(false);
    setStatusToast(res.online ? 'Connected' : 'Disconnected');
    setTimeout(() => setStatusToast(null), 3000);
  };

  const saveCustomUrl = () => {
    const url = customBackendUrl.trim().replace(/\/+$/, '');
    if (url) localStorage.setItem('custom_backend_url', url);
    else localStorage.removeItem('custom_backend_url');
    setStatusToast('Backend URL saved. Reconnecting...');
    setTimeout(() => { checkBackendHealth().then(setBackend); setStatusToast(null); }, 1000);
  };

  // ── Map style ───────────────────────────────────────────────────────────────
  const [mapStyle, setMapStyle] = useState<'theme' | 'satellite' | 'outdoors'>('theme');
  const [showLayersMenu, setShowLayersMenu] = useState(false);
  const [showRouteMenu, setShowRouteMenu] = useState(false);

  // ── Results panel state ─────────────────────────────────────────────────────
  const [showResults, setShowResults] = useState(true);

  // ── AI Prompt ───────────────────────────────────────────────────────────────
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const handleRunAiPrompt = async (promptText: string) => {
    if (!promptText.trim()) return;
    setAiLoading(true);
    try {
      const { parseUserIntent } = await import('./services/api');
      const res = await parseUserIntent(promptText);
      const intent = res.intent;
      if (intent) {
        if (intent.activity) setActivity(intent.activity);
        if (intent.pace) setPace(intent.pace);
        if (intent.deadline_minutes) { setPlanMode('scheduled'); setDeadlineMinutes(intent.deadline_minutes); }
      }
      setActiveTab('map');
      await handleExecutePlan();
    } catch {
      setActiveTab('map');
      await handleExecutePlan();
    } finally { setAiLoading(false); }
  };

  // ── Suggested places fetch ──────────────────────────────────────────────────
  useEffect(() => {
    const targetText = (destText?.trim().length >= 3 && destText !== 'To destination...') ? destText : originText;
    if (targetText?.trim().length >= 3 && backend.url) {
      const t = setTimeout(async () => {
        try {
          const res = await fetch(`${backend.url}/api/assistant/suggest-places`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ origin_text: targetText })
          });
          const data = await res.json();
          if (data?.status === 'ok' && data.places) setSuggestedPlaces(data.places);
        } catch {}
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [originText, destText, backend.url]);

  const handleSelectSuggestedPlace = async (name: string) => {
    setDestText(name);
    const geo = await geocode(name, dest);
    if (geo) { setDest(geo); setIsDestSelected(true); setResponse(null); setShowPlanSetup(true); }
  };

  // ── Journey summary data ────────────────────────────────────────────────────
  const journeyTemps = useMemo(() => {
    if (!activeRoute) return [];
    return (activeRoute as any).geometry_temps?.map((gt: any) => gt[2]) || [activeRoute.avg_temp_c || 28];
  }, [activeRoute]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className={`app-root ${isDark ? 'dark' : 'light'}`} style={{ background: theme.bg }}>

      {/* ── Splash ─────────────────────────────────────────────────────────── */}
      {/* Handled by CSS animation on mount */}

      {/* ── Full-screen MAP (always rendered behind everything) ─────────────── */}
      <div className="map-container">
        <Map
          missionResponse={response}
          originCoord={origin}
          destinationCoord={dest}
          pinMode={pinMode}
          onMapClick={(lat, lng) => {
            if (pinMode === 'origin') { setOrigin({ lat, lng }); setOriginText(`${lat.toFixed(4)}, ${lng.toFixed(4)}`); setResponse(null); }
            else if (pinMode === 'destination') { setDest({ lat, lng }); setDestText(`${lat.toFixed(4)}, ${lng.toFixed(4)}`); setIsDestSelected(true); setResponse(null); }
            setPinMode(null);
          }}
          selectedRouteId={selectedRoute}
          onSelectRoute={setSelectedRoute}
          navPosition={navPosition}
          flyToCoord={flyTo}
          mapStyleKey={mapStyle === 'theme' ? theme.mapStyle : mapStyle}
          isDark={isDark}
          is3D={is3D}
          bearing={mapBearing}
        />
      </div>

      {/* ── TOP NAVBAR ──────────────────────────────────────────────────────── */}
      <div className="top-navbar" style={{ background: theme.topCardBg, borderBottom: `1px solid ${theme.border}` }}>
        {/* Logo */}
        <div className="navbar-logo" style={{ display: 'flex', alignItems: 'center', height: 32 }}>
          <img
            src={isDark ? logoDark : logoLight}
            alt="CoolPath"
            style={{ height: 26, width: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* Weather pill */}
        <div className="navbar-weather" style={{ background: theme.topCardBg, border: `1px solid ${theme.border}`, borderRadius: 20, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Thermometer size={13} color="#34d399" />
          <span style={{ color: theme.textPrimary, fontSize: 13, fontWeight: 600 }}>{formatTemp(liveWeather.tempC)}</span>
          <div style={{ width: 1, height: 12, background: theme.border }} />
          <Wind size={12} color="#38bdf8" />
          <span style={{ color: theme.textSecondary, fontSize: 13 }}>{liveWeather.aqi != null ? `AQI ${liveWeather.aqi}` : 'AQI --'}</span>
          {liveWeather.humidity != null && (
            <>
              <div style={{ width: 1, height: 12, background: theme.border }} />
              <Droplets size={12} color="#818cf8" />
              <span style={{ color: theme.textSecondary, fontSize: 12 }}>{liveWeather.humidity}%</span>
            </>
          )}
        </div>

        <div className="navbar-actions">
          {/* Settings */}
          <button className="icon-btn" onClick={() => setShowSettings(true)} style={{ background: theme.inputBg, border: `1px solid ${theme.border}` }}>
            <Settings size={16} color={theme.textPrimary} />
          </button>
          {/* Backend status dot */}
          <button className="status-dot-btn" onClick={handleRetryBackend} title={backend.online ? `Connected: ${backend.url}` : 'Offline'}>
            {isRetrying
              ? <span className="spinner" />
              : <span className="status-dot" style={{ background: backend.online ? theme.statusOnline : theme.statusOffline }} />
            }
          </button>
        </div>
      </div>

      {/* ── SIDE NAV ────────────────────────────────────────────────────────── */}
      <div className="side-nav" style={{ background: theme.topCardBg, borderRight: `1px solid ${theme.border}` }}>
        {[
          { id: 'map', icon: MapIcon, label: 'Map' },
          { id: 'history', icon: History, label: 'History' },
          { id: 'ai', icon: Sparkles, label: 'AI Hub' },
        ].map(tab => (
          <button
            key={tab.id}
            className={`side-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as any)}
            style={{ color: activeTab === tab.id ? theme.accentCool : theme.textMuted }}
            title={tab.label}
          >
            <tab.icon size={22} />
            <span style={{ fontSize: 10, marginTop: 3, fontWeight: 600 }}>{tab.label}</span>
          </button>
        ))}
        <div className="side-nav-spacer" style={{ flex: 1 }} />
        {/* Mic FAB */}
        <button
          className="side-nav-btn mic-fab"
          onClick={() => setShowAssistant(true)}
          style={{ color: '#fff', background: '#10B981', borderRadius: 14, marginBottom: 8 }}
          title="Voice Assistant"
        >
          <Mic size={20} />
          <span style={{ fontSize: 10, marginTop: 3, fontWeight: 700 }}>AI</span>
        </button>
      </div>

      {/* ── MAP TAB CONTENT ──────────────────────────────────────────────────── */}
      {activeTab === 'map' && uiVisible && !isNavigating && (
        <>
          {/* Status Toast */}
          {statusToast && (
            <div className="status-toast" style={{ background: theme.topCardBg, border: `1px solid ${theme.border}`, color: theme.textPrimary }}>
              <Info size={14} color="#38bdf8" style={{ marginRight: 6 }} />
              {statusToast}
            </div>
          )}
          {feedbackToast && (
            <div className="status-toast" style={{ background: theme.topCardBg, border: `1px solid ${theme.accentCool}`, color: theme.textPrimary, top: statusToast ? 110 : 80 }}>
              <CheckCircle size={14} color={theme.accentCool} style={{ marginRight: 6 }} />
              {feedbackToast}
            </div>
          )}
          {/* Error */}
          {error && (
            <div className="status-toast" style={{ background: theme.topCardBg, border: '1px solid #EF4444', color: '#EF4444', top: statusToast ? 110 : 80 }}>
              <AlertTriangle size={14} style={{ marginRight: 6 }} />
              {error}
              <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 8, color: theme.textMuted }}>
                <X size={13} />
              </button>
            </div>
          )}

          {/* ── COORDINATE CARD ──────────────────────────────────────────────── */}
          <div className="coordinate-card" style={{ background: theme.topCardBg, border: `1px solid ${theme.borderStrong}` }}>
            {/* Destination row — always shown first */}
            <div className="loc-row">
              <div className="loc-dot" style={{ background: '#EF4444' }} />
              <input
                className="loc-input"
                style={{ color: theme.textPrimary, background: 'transparent' }}
                value={destText}
                onChange={e => {
                  setDestText(e.target.value); setActiveSearch('dest');
                  const d = parseCoordString(e.target.value);
                  if (d) { setDest(d); setIsDestSelected(true); }
                }}
                onFocus={() => setActiveSearch('dest')}
                onBlur={() => setTimeout(() => setActiveSearch(null), 200)}
                placeholder="To destination..."
                onKeyDown={async e => {
                  if (e.key === 'Enter') {
                    setActiveSearch(null);
                    const g = await geocode(destText, dest);
                    if (g) { setDest(g); setIsDestSelected(true); setResponse(null); }
                  }
                }}
              />
              <button
                className={`pin-btn ${pinMode === 'destination' ? 'active' : ''}`}
                onClick={() => setPinMode(p => p === 'destination' ? null : 'destination')}
                style={{ background: theme.inputBg, border: `1px solid ${theme.border}` }}
                title="Pin destination on map"
              >
                <LocateFixed size={14} color={pinMode === 'destination' ? '#EF4444' : theme.textSecondary} />
              </button>
              <button
                className="ai-inline-btn"
                onClick={() => setShowAssistant(true)}
                title="Voice Assistant"
              >
                <Mic size={14} color="#fff" />
              </button>
            </div>

            {/* Dest suggestions */}
            {activeSearch === 'dest' && destSuggestions.length > 0 && (
              <div className="suggestions-dropdown" style={{ background: theme.topCardBg, border: `1px solid ${theme.border}` }}>
                {destSuggestions.map(item => (
                  <button key={item.id} className="suggestion-item" style={{ borderBottom: `1px solid ${theme.border}` }}
                    onClick={() => { setDest({ lat: item.lat, lng: item.lng }); setDestText(item.placeName); setDestSuggestions([]); setIsDestSelected(true); setActiveSearch(null); setResponse(null); }}>
                    <MapPin size={14} color="#EF4444" style={{ marginRight: 8, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: theme.textPrimary, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.shortName}</span>
                        {item.badgeLabel && <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 6, marginLeft: 6, flexShrink: 0 }}>{item.badgeLabel}</span>}
                      </div>
                      <span style={{ color: theme.textMuted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.placeName}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Origin row + Swap — only shown after dest is selected */}
            {isDestSelected && (
              <>
                <div className="swap-row">
                  <button className="swap-btn" style={{ background: theme.inputBg, border: `1px solid ${theme.border}` }}
                    onClick={() => { const to = origin; setOrigin(dest); setDest(to); const tt = originText; setOriginText(destText); setDestText(tt); setActiveSearch(null); }}
                  >
                    <ArrowUpDown size={13} color={theme.textSecondary} />
                  </button>
                  <div className="distance-pill" style={{ background: theme.inputBg, border: `1px solid ${theme.border}` }}>
                    <Navigation size={10} color="#10b981" style={{ marginRight: 5 }} />
                    <span style={{ color: theme.textPrimary, fontSize: 12, fontWeight: 700 }}>{formatDist(directDistKm)}</span>
                  </div>
                  {/* Heat scale legend */}
                  <div className="heat-legend" style={{ background: theme.inputBg, border: `1px solid ${theme.border}` }}>
                    <Thermometer size={11} color="#38bdf8" />
                    <span style={{ color: theme.textPrimary, fontSize: 9, fontWeight: 800 }}>24°C</span>
                    <div className="heat-gradient" />
                    <span style={{ color: theme.textPrimary, fontSize: 9, fontWeight: 800 }}>38°C</span>
                  </div>
                </div>

                <div className="loc-row">
                  <div className="loc-dot" style={{ background: '#10B981' }} />
                  <input
                    className="loc-input"
                    style={{ color: theme.textPrimary, background: 'transparent' }}
                    value={originText}
                    onChange={e => { setOriginText(e.target.value); setActiveSearch('origin'); const d = parseCoordString(e.target.value); if (d) setOrigin(d); }}
                    onFocus={() => setActiveSearch('origin')}
                    onBlur={() => setTimeout(() => setActiveSearch(null), 200)}
                    placeholder="From origin..."
                    onKeyDown={async e => {
                      if (e.key === 'Enter') { setActiveSearch(null); const g = await geocode(originText, origin); if (g) { setOrigin(g); setResponse(null); } setShowPlanSetup(true); }
                    }}
                  />
                  <button className={`pin-btn ${pinMode === 'origin' ? 'active' : ''}`}
                    onClick={() => setPinMode(p => p === 'origin' ? null : 'origin')}
                    style={{ background: theme.inputBg, border: `1px solid ${theme.border}` }}
                  >
                    <LocateFixed size={14} color={pinMode === 'origin' ? '#10B981' : theme.textSecondary} />
                  </button>
                </div>

                {/* Origin suggestions */}
                {activeSearch === 'origin' && originSuggestions.length > 0 && (
                  <div className="suggestions-dropdown" style={{ background: theme.topCardBg, border: `1px solid ${theme.border}` }}>
                    {originSuggestions.map(item => (
                      <button key={item.id} className="suggestion-item" style={{ borderBottom: `1px solid ${theme.border}` }}
                        onClick={() => { setOrigin({ lat: item.lat, lng: item.lng }); setOriginText(item.placeName); setOriginSuggestions([]); setActiveSearch(null); setResponse(null); }}>
                        <MapPin size={14} color="#10B981" style={{ marginRight: 8, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: theme.textPrimary, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.shortName}</span>
                            {item.badgeLabel && <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 6, marginLeft: 6, flexShrink: 0 }}>{item.badgeLabel}</span>}
                          </div>
                          <span style={{ color: theme.textMuted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.placeName}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Suggested place chips */}
            {suggestedPlaces.length > 0 && !isDestSelected && (
              <div className="city-chips-row">
                {suggestedPlaces.map((p, i) => (
                  <button key={i} className="city-chip" style={{ background: isDark ? '#1e1b4b' : '#e0e7ff', border: `1px solid ${isDark ? '#4338ca' : '#818cf8'}`, color: isDark ? '#a5b4fc' : '#3730a3' }}
                    onClick={() => { setActiveSearch(null); handleSelectSuggestedPlace(p); }}>
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Plan button row */}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="plan-btn" onClick={() => setShowPlanSetup(true)} style={{ flex: 1 }}>
                <Leaf size={16} style={{ marginRight: 8 }} />
                {response ? 'Recalculate Route' : 'Plan CoolPath Route'}
              </button>
              <button className="icon-btn" onClick={handleGeolocate} style={{ background: theme.inputBg, border: `1px solid ${theme.border}` }} title="Use current location">
                <LocateFixed size={16} color={theme.accentCool} />
              </button>
            </div>
          </div>

          {/* ── MAP CONTROL FABs ──────────────────────────────────────────────── */}
          <div className="fab-stack-right">
            {/* GPS Location FAB */}
            <button
              className="fab-btn"
              onClick={handleGeolocate}
              style={{ background: theme.topCardBg, border: `1.5px solid ${theme.accentCool}`, color: theme.accentCool }}
              title="Get Current GPS Location"
            >
              {isFetchingLocation ? <span className="spinner blue" /> : <Navigation size={20} />}
            </button>

            {/* 2D / 3D Pitch FAB */}
            <button
              className="fab-btn"
              onClick={() => { setIs3D(p => !p); setStatusToast(is3D ? '2D Flat View' : '3D Perspective View'); setTimeout(() => setStatusToast(null), 2000); }}
              style={{ background: theme.topCardBg, border: is3D ? `1.5px solid ${theme.accentCool}` : `1px solid ${theme.border}`, color: is3D ? theme.accentCool : theme.textPrimary }}
              title={is3D ? "Switch to 2D Flat View" : "Switch to 3D Perspective View"}
            >
              {is3D ? <span style={{ fontSize: 11, fontWeight: 900, color: theme.accentCool }}>3D</span> : <Box size={18} />}
            </button>

            {/* Reset North Compass FAB */}
            <button
              className="fab-btn"
              onClick={() => { setMapBearing(0); setIs3D(false); setStatusToast('Re-centered North'); setTimeout(() => setStatusToast(null), 2000); }}
              style={{ background: theme.topCardBg, border: `1px solid ${theme.border}`, color: theme.textPrimary }}
              title="Reset Map North"
            >
              <Compass size={20} color={theme.textPrimary} />
            </button>

            {/* Map Layers FAB */}
            <button className="fab-btn" onClick={() => setShowLayersMenu(p => !p)}
              style={{ background: theme.topCardBg, border: `1.5px solid ${theme.accentCool}`, color: theme.accentCool }}
              title="Map Layers"
            >
              <Layers size={20} />
            </button>
            {showLayersMenu && (
              <div className="layers-menu" style={{ background: theme.topCardBg, border: `1px solid ${theme.border}` }}>
                {(['theme', 'satellite', 'outdoors'] as const).map(s => (
                  <button key={s} className={`layer-btn ${mapStyle === s ? 'active' : ''}`}
                    onClick={() => { setMapStyle(s); setShowLayersMenu(false); }}
                    style={{ background: mapStyle === s ? theme.accentCool : 'transparent', color: mapStyle === s ? (isDark ? '#0C1210' : '#fff') : theme.textPrimary }}
                    title={s}
                  >
                    {s === 'theme' ? <MapIcon size={16} /> : s === 'satellite' ? <Sun size={16} /> : <Leaf size={16} />}
                    <span style={{ fontSize: 10, marginTop: 2, textTransform: 'capitalize' }}>{s}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Route selection FAB */}
            {response && (response.route_options?.length ?? 0) > 0 && (
              <div style={{ position: 'relative' }}>
                <button className="fab-btn" onClick={() => setShowRouteMenu(p => !p)}
                  style={{ background: theme.topCardBg, border: `1.5px solid #38bdf8`, color: '#38bdf8' }}
                  title="Switch Route"
                >
                  {selectedRoute === 'fastest' ? <Zap size={18} /> : selectedRoute === 'coolest' ? <Snowflake size={18} /> : <Scale size={18} />}
                </button>
                {showRouteMenu && (
                  <div className="route-menu" style={{ background: theme.topCardBg, border: `1px solid ${theme.border}` }}>
                    {response.route_options!.map(route => {
                      const sel = route.id === selectedRoute;
                      const col = ROUTE_COLORS[route.id] || '#38bdf8';
                      return (
                        <button key={route.id} className={`route-menu-item ${sel ? 'selected' : ''}`}
                          onClick={() => { setSelectedRoute(route.id); setShowRouteMenu(false); }}
                          style={{ background: sel ? `rgba(56,189,248,0.12)` : 'transparent' }}
                        >
                          <div style={{ width: 28, height: 28, borderRadius: 14, background: sel ? col : theme.inputBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                            {route.id === 'fastest' ? <Zap size={14} color={sel ? '#fff' : col} /> : route.id === 'coolest' ? <Snowflake size={14} color={sel ? '#fff' : col} /> : <Navigation size={14} color={sel ? '#fff' : col} />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: theme.textPrimary, fontSize: 12, fontWeight: 800 }}>{route.name}</div>
                            <div style={{ color: theme.textMuted, fontSize: 10 }}>{route.travel_minutes} min • ~{formatTemp(route.avg_temp_c)}</div>
                          </div>
                          {sel && <CheckCircle size={14} color={theme.accentCool} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── BOTTOM RESULTS PANEL ──────────────────────────────────────────── */}
          {response && (
            <div className="bottom-results-panel" style={{ background: theme.sheetBg, border: `1px solid ${theme.border}` }}>
              <div className="results-header">
                <button className="chevron-btn" onClick={() => setShowResults(p => !p)} style={{ color: theme.accentCool }}>
                  {showResults ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                  <span style={{ color: theme.textMuted, fontSize: 12, fontWeight: 700 }}>CoolPath Metrics</span>
                </button>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button className="start-nav-btn" onClick={() => setShowNavSetup(true)}>
                    <Play size={13} style={{ marginRight: 4 }} /> Start Nav
                  </button>
                  <button className="discard-btn" onClick={handleDiscardJourney} style={{ color: '#fca5a5', background: theme.inputBg, border: `1px solid ${theme.border}` }}>
                    <X size={14} />
                  </button>
                </div>
              </div>

              {showResults && (
                <div className="results-body" style={{ maxHeight: '38vh', overflowY: 'auto' }}>
                  {/* Thermal Protection Card */}
                  {activeRoute && (
                    <div className="thermal-card" style={{ background: isDark ? 'linear-gradient(135deg, #064e3b, #022c22)' : 'linear-gradient(135deg, #d1fae5, #a7f3d0)', border: '1.5px solid #10b981' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 14, background: 'rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Shield size={15} color={isDark ? '#34d399' : '#047857'} />
                          </div>
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 800, color: isDark ? '#a7f3d0' : '#065f46', letterSpacing: 0.6, textTransform: 'uppercase' }}>PHYSICS-ML THERMAL PROTECTION</div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? '#fff' : '#064e3b' }}>Optimal Microclimate Route</div>
                          </div>
                        </div>
                        <div style={{ background: isDark ? '#10b981' : '#047857', padding: '3px 10px', borderRadius: 20 }}>
                          <span style={{ fontSize: 10, fontWeight: 900, color: '#fff' }}>VERIFIED SHADE</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.65)', borderRadius: 12, padding: 10, border: `1px solid ${isDark ? 'rgba(52,211,153,0.2)' : 'rgba(4,120,87,0.2)'}` }}>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 800, color: isDark ? '#9ca3af' : '#4b5563', textTransform: 'uppercase' }}>HEAT STRAIN SAVINGS</div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: isDark ? '#34d399' : '#047857', fontFamily: 'monospace' }}>
                            {activeRoute.thermal_reduction_percent > 0 ? `-${activeRoute.thermal_reduction_percent}%` : 'OPTIMAL'}
                          </div>
                        </div>
                        <div style={{ width: 1, height: 28, background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' }} />
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 800, color: isDark ? '#9ca3af' : '#4b5563', textTransform: 'uppercase' }}>EXPOSURE LOAD</div>
                          <div style={{ fontSize: 14, fontWeight: 900, color: isDark ? '#fff' : '#111827', fontFamily: 'monospace' }}>{activeRoute.thermal_exposure ?? '--'} J/s</div>
                        </div>
                        <div style={{ width: 1, height: 28, background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' }} />
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 800, color: isDark ? '#9ca3af' : '#4b5563', textTransform: 'uppercase' }}>DURATION</div>
                          <div style={{ fontSize: 14, fontWeight: 900, color: isDark ? '#fff' : '#111827', fontFamily: 'monospace' }}>{activeRoute.travel_minutes} min</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Selected Route Card */}
                  {activeRoute && (
                    <div className="route-card" style={{ background: theme.sheetBg === '#151F1B' ? '#1E2A24' : '#fff', border: `1.5px solid ${theme.accentCool}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            {activeRoute.id === 'fastest' ? <Zap size={13} color={theme.accentFast} /> : activeRoute.id === 'coolest' ? <Snowflake size={13} color={theme.accentCool} /> : <Scale size={13} color={theme.accentBalanced} />}
                            <span style={{ fontSize: 10, fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>ACTIVE SELECTED ROUTE</span>
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 900, color: theme.textPrimary }}>{activeRoute.name}</div>
                        </div>
                        {activeRoute.is_recommended && (
                          <div style={{ background: 'rgba(224,184,74,0.16)', padding: '3px 8px', borderRadius: 8, border: `1px solid ${theme.accentGold}` }}>
                            <span style={{ fontSize: 10, fontWeight: 900, color: theme.accentGold }}>BEST CHOICE</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: theme.inputBg, padding: 10, borderRadius: 10, marginBottom: 8 }}>
                        <div><div style={{ fontSize: 9, color: theme.textMuted, fontWeight: 700 }}>EST. DURATION</div><div style={{ fontSize: 14, fontWeight: 900, color: theme.textPrimary, fontFamily: 'monospace' }}>{activeRoute.travel_minutes} min</div></div>
                        <div><div style={{ fontSize: 9, color: theme.textMuted, fontWeight: 700 }}>AVG TEMP</div><div style={{ fontSize: 14, fontWeight: 900, color: theme.textPrimary, fontFamily: 'monospace' }}>~{formatTemp(activeRoute.avg_temp_c)}</div></div>
                        <div><div style={{ fontSize: 9, color: theme.textMuted, fontWeight: 700 }}>HEAT LOAD</div><div style={{ fontSize: 14, fontWeight: 900, color: theme.textPrimary, fontFamily: 'monospace' }}>{activeRoute.thermal_exposure ?? '--'} J/s</div></div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: `0.5px solid ${theme.border}` }}>
                        <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 600 }}>Rate route choice:</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {ratedRoutes[activeRoute.id] ? (
                            <div style={{ display: 'flex', alignItems: 'center', padding: '3px 8px', background: 'rgba(16,185,129,0.1)', borderRadius: 6 }}>
                              <CheckCircle size={11} color={theme.accentCool} style={{ marginRight: 4 }} />
                              <span style={{ fontSize: 10, fontWeight: 800, color: theme.accentCool }}>Feedback Saved</span>
                            </div>
                          ) : (
                            <>
                              <button className="feedback-btn like" onClick={() => handleFeedback(activeRoute.id, true)}>
                                <ThumbsUp size={11} /> <span>Like</span>
                              </button>
                              <button className="feedback-btn dislike" onClick={() => handleFeedback(activeRoute.id, false)}>
                                <ThumbsDown size={11} /> <span>Pass</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Optimal Departure Timing */}
                  {response && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={14} color="#fbbf24" />
                          <span style={{ fontSize: 10, fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>OPTIMAL DEPARTURE WINDOW</span>
                        </div>
                        <div style={{ background: 'rgba(251,191,36,0.15)', padding: '2px 8px', borderRadius: 6 }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: '#fbbf24' }}>{response.planning_mode === 'scheduled' ? 'SCHEDULED' : 'INSTANT DEPARTURE'}</span>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {[
                          { icon: <Clock size={12} color="#fbbf24" />, label: 'BEST DEPARTURE', value: response.optimal_departure_time || 'Depart Now', color: 'rgba(251,191,36,0.3)' },
                          { icon: <Hourglass size={12} color="#38bdf8" />, label: 'RECOMMENDED WAIT', value: response.wait_minutes > 0 ? `+${response.wait_minutes} min` : '0 min (Immediate)', color: 'rgba(56,189,248,0.3)' },
                          { icon: <TrendingDown size={12} color="#10b981" />, label: 'THERMAL SAVINGS', value: response.thermal_reduction_percent > 0 ? `-${response.thermal_reduction_percent}% Heat` : 'Optimal', color: 'rgba(16,185,129,0.3)' },
                          { icon: <Gauge size={12} color="#a78bfa" />, label: 'TARGET PACE', value: response.recommended_action?.pace || pace || 'Normal', color: 'rgba(167,139,250,0.3)' },
                        ].map((box, i) => (
                          <div key={i} style={{ background: theme.inputBg, padding: 10, borderRadius: 10, border: `1px solid ${box.color}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>{box.icon}<span style={{ fontSize: 9, fontWeight: 800, color: theme.textMuted, letterSpacing: 0.3 }}>{box.label}</span></div>
                            <div style={{ fontSize: 13, fontWeight: 900, color: theme.textPrimary, fontFamily: 'monospace', textTransform: 'capitalize' }}>{box.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ML Comfort Profile */}
                  <div style={{ padding: 14, borderRadius: 14, background: theme.inputBg, border: `1.5px solid ${theme.border}`, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Brain size={14} color="#10b981" />
                        <span style={{ fontSize: 11, fontWeight: 800, color: theme.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Learned Comfort Profile</span>
                      </div>
                      <button onClick={() => setShowMLInsights(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800, color: '#10b981' }}>
                        {shadePreferencePct.toFixed(0)}% Shade ⓘ
                      </button>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(95, Math.max(10, shadePreferencePct))}%`, background: '#10b981', borderRadius: 3 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                      <span style={{ fontSize: 10, color: theme.textMuted }}>Speed Focus</span>
                      <span style={{ fontSize: 10, color: theme.textMuted }}>Shade Focus</span>
                    </div>
                  </div>

                  {/* FortyGuard Sensors */}
                  {response.env_summary && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>FORTYGUARD ENVIRONMENTAL SENSORS</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {[
                          { icon: <Thermometer size={13} color="#38bdf8" />, val: `${response.env_summary.apparent_temp_c ?? '--'}°C`, lbl: 'Real-Feel' },
                          { icon: <Sun size={13} color="#fbbf24" />, val: `${response.env_summary.ghi_solar_w_m2 ?? '--'} W/m²`, lbl: 'Solar GHI' },
                          { icon: <Droplets size={13} color="#818cf8" />, val: `${response.env_summary.relative_humidity_pct ?? '--'}%`, lbl: 'Humidity' },
                          { icon: <Wind size={13} color="#34d399" />, val: `${response.env_summary.air_quality_level ?? '--'}`, lbl: 'Air Quality' },
                        ].map((e, i) => (
                          <div key={i} style={{ background: theme.inputBg, padding: 10, borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            {e.icon}
                            <div style={{ fontSize: 14, fontWeight: 900, color: theme.textPrimary, fontFamily: 'monospace' }}>{e.val}</div>
                            <div style={{ fontSize: 9, color: theme.textMuted, fontWeight: 700 }}>{e.lbl}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gemini Briefing */}
                  {response.gemini_briefing && (
                    <div style={{ background: isDark ? '#1e1b4b' : '#e0e7ff', border: `1px solid ${isDark ? '#312e81' : '#c7d2fe'}`, borderRadius: 14, padding: 14, marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                        <Sparkles size={11} color={isDark ? '#c7d2fe' : '#4338ca'} />
                        <span style={{ fontSize: 9, fontWeight: 800, color: isDark ? '#818cf8' : '#3730a3', letterSpacing: 0.5 }}>GEMINI AI BRIEFING</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? '#fff' : '#1e1b4b', marginBottom: 6 }}>{response.gemini_briefing.headline}</div>
                      <div style={{ fontSize: 12, color: isDark ? '#c7d2fe' : '#312e81', lineHeight: 1.5 }}>{response.gemini_briefing.narrative}</div>
                      {response.gemini_briefing.health_alert && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
                          <AlertTriangle size={11} color="#fca5a5" />
                          <span style={{ fontSize: 11, color: '#fca5a5' }}>{response.gemini_briefing.health_alert}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── NAVIGATION HUD ───────────────────────────────────────────────────── */}
      {isNavigating && (
        <div className="nav-hud" style={{ background: isDark ? 'rgba(12,18,16,0.88)' : 'rgba(246,243,236,0.88)', border: `1px solid ${theme.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Avatar */}
            <div style={{ width: 48, height: 48, borderRadius: 24, background: theme.inputBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {activity === 'driving' ? <Car size={24} color={theme.accentCool} /> : activity === 'biking' ? <Bike size={24} color={theme.accentCool} /> : <Footprints size={24} color={theme.accentCool} />}
            </div>
            {/* Stats */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: theme.textPrimary, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  {activity === 'driving' ? 'Commuter' : activity === 'biking' ? 'Rider' : 'Maya'}
                </span>
                <div style={{ background: commuterBodyTemp > 38 ? 'rgba(232,137,94,0.16)' : 'rgba(45,217,184,0.16)', padding: '2px 6px', borderRadius: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: commuterBodyTemp > 38 ? theme.accentHeat : theme.accentCool }}>
                    {commuterBodyTemp > 38 ? 'HEAT STRAIN' : 'COMFORT STABLE'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { label: 'BODY TEMP', value: `${commuterBodyTemp.toFixed(1)}°C` },
                  { label: 'SPEED', value: `${navSpeedKmh} km/h` },
                  { label: 'REAL-FEEL', value: formatTemp(navCurrentTempC) },
                ].map((s, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 9, color: theme.textMuted }}>{s.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: theme.textPrimary, fontFamily: 'monospace' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* A/C toggle for driving */}
            {activity === 'driving' && (
              <button onClick={() => setAcOn(p => !p)} style={{ width: 40, height: 40, borderRadius: 20, background: acOn ? 'rgba(45,217,184,0.15)' : 'rgba(232,137,94,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {acOn ? <Snowflake size={18} color={theme.accentCool} /> : <Flame size={18} color={theme.accentHeat} />}
              </button>
            )}
            {/* Stop navigation */}
            <button onClick={stopNavigation} style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(239,68,68,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Square size={18} color="#ef4444" />
            </button>
          </div>

          {/* Sim speed controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: `0.5px solid ${theme.border}` }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: theme.textMuted, letterSpacing: 0.3 }}>SIMULATION SPEED</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={() => adjustSimSpeed('down')} className="speed-btn" style={{ background: theme.inputBg, border: `0.5px solid ${theme.border}` }}><Minus size={14} color={theme.textPrimary} /></button>
              <span style={{ fontSize: 12, fontWeight: 800, width: 60, textAlign: 'center', color: theme.textPrimary, fontFamily: 'monospace' }}>{simSpeedKmh} km/h</span>
              <button onClick={() => adjustSimSpeed('up')} className="speed-btn" style={{ background: theme.inputBg, border: `0.5px solid ${theme.border}` }}><Plus size={14} color={theme.textPrimary} /></button>
            </div>
          </div>

          {/* Maya subtitle */}
          {typedSubtitle && (
            <div style={{ marginTop: 8, background: theme.inputBg, borderRadius: 8, padding: 8, border: `0.5px solid ${theme.border}` }}>
              <span style={{ fontSize: 12, color: theme.textPrimary, fontStyle: 'italic', lineHeight: 1.5 }}>"{typedSubtitle}"</span>
            </div>
          )}

          {/* Progress bar */}
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted }}>JOURNEY COMPLETION</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: theme.accentCool, fontFamily: 'monospace' }}>{navProgressPct}%</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: theme.border, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${navProgressPct}%`, background: theme.accentCool, borderRadius: 3, transition: 'width 0.5s' }} />
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="tab-panel" style={{ background: theme.bg }}>
          <div className="tab-header" style={{ borderBottom: `1px solid ${theme.border}` }}>
            <div>
              <h2 style={{ color: theme.textPrimary, fontSize: 20, fontWeight: 900, margin: 0 }}>Route History</h2>
              <p style={{ color: theme.textMuted, fontSize: 12, margin: '4px 0 0' }}>Cached past heat-aware journeys</p>
            </div>
            {historyList.length > 0 && (
              <button className="clear-btn" onClick={() => { if (window.confirm('Clear all history?')) { setHistoryList([]); localStorage.removeItem('coolpath_history'); } }}>
                <Trash2 size={14} style={{ marginRight: 4 }} /> Clear
              </button>
            )}
          </div>
          <div className="tab-body">
            {historyList.length === 0 ? (
              <div className="empty-state">
                <History size={48} color={theme.textMuted} style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: theme.textPrimary, marginBottom: 8 }}>No Saved Journeys</div>
                <div style={{ fontSize: 13, color: theme.textMuted, textAlign: 'center', maxWidth: 280 }}>Plan a route on the map to automatically cache your cool walking & biking paths here.</div>
              </div>
            ) : (
              historyList.map(item => (
                <button key={item.id} className="history-card" style={{ background: theme.topCardBg, border: `1px solid ${theme.border}` }}
                  onClick={() => handleRestoreHistory(item)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {item.activity === 'driving' ? <Car size={13} color="#38bdf8" /> : item.activity === 'biking' ? <Bike size={13} color="#38bdf8" /> : item.activity === 'running' ? <Flame size={13} color="#38bdf8" /> : <Footprints size={13} color="#38bdf8" />}
                      <span style={{ color: theme.textMuted, fontSize: 12 }}>{new Date(item.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</span>
                    </div>
                    {item.response.thermal_reduction_percent > 0 && (
                      <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>
                        -{item.response.thermal_reduction_percent}% Heat
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: '#10B981' }} />
                    <span style={{ color: theme.textPrimary, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.originText}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: '#EF4444' }} />
                    <span style={{ color: theme.textPrimary, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.destText}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: theme.textSecondary, fontSize: 12 }}>
                      {item.response.route_options?.[0]?.travel_minutes ?? '--'} min • ~{formatTemp(item.response.route_options?.[0]?.avg_temp_c)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', color: '#10b981', fontSize: 12, fontWeight: 700 }}>
                      View on Map <ChevronRight size={14} />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── AI HUB TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'ai' && (
        <div className="tab-panel" style={{ background: theme.bg }}>
          <div className="tab-header" style={{ borderBottom: `1px solid ${theme.border}` }}>
            <div>
              <h2 style={{ color: theme.textPrimary, fontSize: 20, fontWeight: 900, margin: 0 }}>CoolPath Hub</h2>
              <p style={{ color: theme.textMuted, fontSize: 12, margin: '4px 0 0' }}>Interactive AI navigation & climate controls</p>
            </div>
            <button className="icon-btn" onClick={() => setShowSettings(true)} style={{ background: theme.inputBg, border: `1px solid ${theme.border}` }}>
              <Settings size={18} color={theme.textPrimary} />
            </button>
          </div>
          <div className="tab-body">
            {/* Voice Assistant Hero */}
            <button className="ai-hero-card" style={{ background: theme.topCardBg, border: '1.5px solid #10B981' }} onClick={() => setShowAssistant(true)}>
              <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 24, background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Mic size={24} color="#fff" />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: theme.textPrimary }}>CoolPath Voice Assistant</div>
                  <div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>Live conversational speech & LangChain AI tool routing</div>
                </div>
              </div>
              <div style={{ background: '#10B981', padding: '8px 14px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Sparkles size={13} color="#fff" />
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>Talk Live</span>
              </div>
            </button>

            {/* Natural Language Planner */}
            <div className="ai-card" style={{ background: theme.topCardBg, border: `1px solid ${theme.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <Sparkles size={15} color="#38bdf8" style={{ marginRight: 8 }} />
                <span style={{ fontSize: 14, fontWeight: 800, color: theme.textPrimary }}>Natural Language Route Planner</span>
              </div>
              <textarea
                className="ai-textarea"
                style={{ color: theme.textPrimary, background: theme.inputBg, border: `1px solid ${theme.border}` }}
                placeholder="Enter prompt e.g. 'Dog walk avoiding hot pavement'..."
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                rows={3}
              />
              <button className="ai-submit-btn" onClick={() => handleRunAiPrompt(aiPrompt)} disabled={aiLoading}>
                {aiLoading ? <span className="spinner white" /> : <><Sparkles size={15} style={{ marginRight: 6 }} />Generate Heat-Aware Plan</>}
              </button>
              <div style={{ fontSize: 10, fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 8 }}>TRY AI PRESETS</div>
              {AI_PRESETS.map((p, i) => (
                <button key={i} className="preset-btn" style={{ background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.textPrimary }}
                  onClick={() => { setAiPrompt(p.prompt); handleRunAiPrompt(p.prompt); }}>
                  <Sparkles size={13} color="#38bdf8" style={{ marginRight: 8, flexShrink: 0 }} />
                  {p.prompt}
                </button>
              ))}
            </div>

            {/* Temperature Analytics Graph */}
            <div className="ai-card" style={{ background: theme.topCardBg, border: `1px solid ${theme.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <BarChart3 size={17} color="#2DD9B8" style={{ marginRight: 8 }} />
                <span style={{ fontSize: 14, fontWeight: 800, color: theme.textPrimary }}>Route Temperature Analytics</span>
              </div>
              <p style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 14 }}>Real-time microclimate variation: Direct unshaded asphalt vs. CoolPath recommended tree-canopy route.</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[{ label: 'SHADED AVG', val: '29.4°C', color: '#10b981' }, { label: 'DIRECT ASPHALT', val: '48.2°C', color: '#f43f5e' }, { label: 'COOL RELIEF', val: '-6.8°C', color: '#2DD9B8' }].map((s, i) => (
                  <div key={i} style={{ flex: 1, background: theme.inputBg, padding: 10, borderRadius: 10, border: `0.5px solid ${theme.border}` }}>
                    <div style={{ fontSize: 9, color: theme.textMuted, fontWeight: 700 }}>{s.label}</div>
                    <div style={{ fontSize: 17, fontWeight: 900, color: s.color, marginTop: 2 }}>{s.val}</div>
                  </div>
                ))}
              </div>
              {/* SVG Chart */}
              <svg height="120" viewBox="0 0 320 120" style={{ width: '100%' }}>
                <defs>
                  <linearGradient id="gCool" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#10b981" stopOpacity="0.35" /><stop offset="1" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="gHot" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#f43f5e" stopOpacity="0.25" /><stop offset="1" stopColor="#f43f5e" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <line x1="25" y1="15" x2="310" y2="15" stroke={theme.border} strokeWidth="1" strokeDasharray="4 4" />
                <line x1="25" y1="50" x2="310" y2="50" stroke={theme.border} strokeWidth="1" strokeDasharray="4 4" />
                <line x1="25" y1="85" x2="310" y2="85" stroke={theme.border} strokeWidth="1" strokeDasharray="4 4" />
                <line x1="25" y1="110" x2="310" y2="110" stroke={theme.border} strokeWidth="1" />
                <text x="0" y="18" fill={theme.textMuted} fontSize="8">50°C</text>
                <text x="0" y="53" fill={theme.textMuted} fontSize="8">40°C</text>
                <text x="0" y="88" fill={theme.textMuted} fontSize="8">30°C</text>
                <text x="0" y="113" fill={theme.textMuted} fontSize="8">20°C</text>
                <path d="M 35 36 Q 90 15, 150 28 T 260 13 T 300 24 L 300 110 L 35 110 Z" fill="url(#gHot)" />
                <path d="M 35 36 Q 90 15, 150 28 T 260 13 T 300 24" fill="none" stroke="#f43f5e" strokeWidth="2.5" />
                <path d="M 35 80 Q 90 88, 150 73 T 260 82 T 300 76 L 300 110 L 35 110 Z" fill="url(#gCool)" />
                <path d="M 35 80 Q 90 88, 150 73 T 260 82 T 300 76" fill="none" stroke="#10b981" strokeWidth="3" />
                <circle cx="150" cy="28" r="4" fill="#f43f5e" />
                <circle cx="150" cy="73" r="5" fill="#10b981" stroke="#fff" strokeWidth="1.5" />
                <circle cx="260" cy="13" r="4" fill="#f43f5e" />
                <circle cx="260" cy="82" r="5" fill="#10b981" stroke="#fff" strokeWidth="1.5" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}><div style={{ width: 12, height: 3, background: '#f43f5e', borderRadius: 2, marginRight: 6 }} /><span style={{ fontSize: 11, color: theme.textSecondary }}>Direct Unshaded (Hot)</span></div>
                <div style={{ display: 'flex', alignItems: 'center' }}><div style={{ width: 12, height: 3, background: '#10b981', borderRadius: 2, marginRight: 6 }} /><span style={{ fontSize: 11, color: theme.textSecondary }}>CoolPath Shaded Route</span></div>
              </div>
            </div>

            {/* CoolPath Engines */}
            <div style={{ fontSize: 10, fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>COOLPATH ENGINES</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { icon: <Target size={17} color="#fbbf24" />, title: 'Paw Pad Guard', sub: 'Sunlit asphalt can reach 55°C+. CoolPath limits exposure to hot asphalt to protect pet paws.' },
                { icon: <Brain size={17} color="#f43f5e" />, title: 'Hyperthermia Tuning', sub: 'Monitors metabolic heat buildup during fast activities, keeping core thermal strain in the safe zone.' },
              ].map((c, i) => (
                <div key={i} className="feature-card" style={{ background: theme.topCardBg, border: `1px solid ${theme.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>{c.icon}<span style={{ fontSize: 13, fontWeight: 800, color: theme.textPrimary }}>{c.title}</span></div>
                  <p style={{ fontSize: 12, color: theme.textSecondary, margin: 0, lineHeight: 1.4 }}>{c.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── PLAN SETUP MODAL ─────────────────────────────────────────────────── */}
      {showPlanSetup && (
        <div className="modal-overlay" onClick={() => setShowPlanSetup(false)}>
          <div className="modal-card" style={{ background: theme.sheetBg, border: `1px solid ${theme.border}` }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontSize: 16, fontWeight: 900, color: theme.textPrimary }}>Plan CoolPath Journey</span>
              <button className="modal-close" onClick={() => setShowPlanSetup(false)}><X size={20} color={theme.textMuted} /></button>
            </div>

            <div className="section-label" style={{ color: theme.textMuted }}>DEPARTURE TIMING</div>
            <div className="mode-tabs" style={{ background: theme.inputBg }}>
              {(['instant', 'scheduled'] as PlanningMode[]).map(m => (
                <button key={m} className={`mode-tab ${planMode === m ? 'active' : ''}`} onClick={() => setPlanMode(m)}
                  style={{ color: planMode === m ? '#fff' : theme.textMuted, background: planMode === m ? '#10b981' : 'transparent' }}>
                  {m === 'instant' ? <Zap size={12} style={{ marginRight: 5 }} /> : <Clock size={12} style={{ marginRight: 5 }} />}
                  {m === 'instant' ? 'Depart Now' : 'Scheduled'}
                </button>
              ))}
            </div>

            {planMode === 'scheduled' && (
              <div className="deadline-card" style={{ background: theme.inputBg, border: `1px solid ${theme.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: theme.textMuted }}>ARRIVE WITHIN</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: theme.textPrimary }}>{deadlineMinutes} min</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {DEADLINE_OPTIONS.map(m => (
                    <button key={m} className={`deadline-chip ${deadlineMinutes === m ? 'active' : ''}`}
                      onClick={() => setDeadlineMinutes(m)}
                      style={{ background: deadlineMinutes === m ? theme.accentCool : theme.sheetBg, color: deadlineMinutes === m ? (isDark ? '#0C1210' : '#fff') : theme.textSecondary, border: 'none', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="section-label" style={{ color: theme.textMuted, marginTop: 16 }}>ACTIVITY</div>
            <div className="pill-row">
              {ACTIVITIES.map(a => {
                const on = activity === a.id;
                return (
                  <button key={a.id} className={`activity-pill ${on ? 'active' : ''}`} onClick={() => setActivity(a.id)}
                    style={{ background: on ? '#10b981' : theme.inputBg, color: on ? '#fff' : theme.textMuted, border: `1px solid ${on ? '#10b981' : theme.border}` }}>
                    <a.icon size={13} style={{ marginRight: 5 }} />
                    {a.label}
                  </button>
                );
              })}
            </div>

            <div className="section-label" style={{ color: theme.textMuted, marginTop: 12 }}>PACE</div>
            <div className="pill-row">
              {PACES.map(p => {
                const on = pace === p.id;
                return (
                  <button key={p.id} className={`pace-pill ${on ? 'active' : ''}`} onClick={() => setPace(p.id)}
                    style={{ background: on ? '#10b981' : theme.inputBg, color: on ? '#fff' : theme.textMuted, border: `1px solid ${on ? '#10b981' : theme.border}` }}>
                    {p.label}
                  </button>
                );
              })}
            </div>

            <button className="calc-btn" onClick={handleExecutePlan} disabled={loading || isCrafting}>
              {loading || isCrafting ? <span className="spinner white" style={{ marginRight: 8 }} /> : <Leaf size={17} style={{ marginRight: 8 }} />}
              Confirm & Calculate Route
            </button>
          </div>
        </div>
      )}

      {/* ── CRAFTING LOADING MODAL ────────────────────────────────────────────── */}
      {isCrafting && (
        <div className="modal-overlay crafting-overlay">
          <div className="crafting-card" style={{ background: isDark ? '#0C1210' : '#F6F3EC', border: `1px solid ${theme.border}` }}>
            <div className="crafting-icon-wrap">
              <div className="pulse-ring" style={{ borderColor: theme.accentCool }} />
              <div className="crafting-icon-circle" style={{ background: theme.surfaceInset }}>
                <Leaf size={28} color={theme.accentCool} />
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: theme.textPrimary, marginTop: 16 }}>Crafting CoolPath Route</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>Urban Heat Avoidance Engine</div>
            <div className="phrase-box" style={{ background: theme.inputBg, border: `1px solid ${theme.border}` }}>
              <span className="spinner blue" style={{ marginRight: 10 }} />
              <span style={{ color: theme.textPrimary, fontSize: 13 }}>{CRAFTING_STEPS[craftStep]}</span>
            </div>
            <div className="dots-row">
              {CRAFTING_STEPS.map((_, i) => (
                <div key={i} className={`dot ${i <= craftStep ? 'active' : ''}`} style={{ background: i <= craftStep ? theme.accentCool : theme.border }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── NAV SETUP MODAL ──────────────────────────────────────────────────── */}
      {showNavSetup && (
        <div className="modal-overlay" onClick={() => setShowNavSetup(false)}>
          <div className="modal-card" style={{ background: theme.sheetBg, border: `1px solid ${theme.border}` }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontSize: 16, fontWeight: 900, color: theme.textPrimary }}>Choose Navigation Mode</span>
              <button className="modal-close" onClick={() => setShowNavSetup(false)}><X size={20} color={theme.textMuted} /></button>
            </div>
            <p style={{ color: theme.textMuted, fontSize: 12, marginBottom: 16 }}>Select how you want to navigate along {activeRoute?.name || 'CoolPath Route'}</p>
            {[
              { mode: 'real', icon: <LocateFixed size={22} color={theme.accentCool} />, title: 'Real Device GPS', sub: 'Uses your browser\'s hardware GPS sensors for live navigation' },
              { mode: 'simulated', icon: <Sparkles size={22} color={theme.accentCool} />, title: 'Maya Virtual Traveler', sub: 'Maya travels the route with witty, live voice commentary & heat insights' },
            ].map(opt => (
              <button key={opt.mode} className={`nav-mode-card ${navMode === opt.mode ? 'selected' : ''}`}
                style={{ background: theme.inputBg, border: navMode === opt.mode ? `2px solid ${theme.accentCool}` : `1px solid ${theme.border}` }}
                onClick={() => setNavMode(opt.mode as any)}>
                <div style={{ marginRight: 12 }}>{opt.icon}</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: theme.textPrimary }}>{opt.title}</div>
                  <div style={{ fontSize: 12, color: theme.textMuted }}>{opt.sub}</div>
                </div>
                {navMode === opt.mode && <CheckCircle size={18} color={theme.accentCool} />}
              </button>
            ))}
            <button className="calc-btn" style={{ marginTop: 14 }} onClick={() => startNavigation(navMode)}>
              <Play size={16} style={{ marginRight: 6 }} /> Start Navigation Now
            </button>
          </div>
        </div>
      )}

      {/* ── JOURNEY SUMMARY MODAL ─────────────────────────────────────────────── */}
      {showJourneySummary && activeRoute && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ background: theme.sheetBg, border: `1px solid ${theme.border}` }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 24, background: 'rgba(45,217,184,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Trophy size={24} color={theme.accentCool} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: theme.textPrimary }}>Journey Completed!</div>
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>You traveled along {activeRoute.name || 'CoolPath Route'}</div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, background: theme.inputBg, borderRadius: 10, padding: 12, border: `0.5px solid ${theme.border}` }}>
                <div style={{ fontSize: 10, color: theme.textMuted }}>TOTAL TIME</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: theme.textPrimary, fontFamily: 'monospace', marginTop: 4 }}>
                  {journeyDuration > 60 ? `${Math.floor(journeyDuration/60)}m ${journeyDuration%60}s` : `${journeyDuration}s`}
                </div>
              </div>
              <div style={{ flex: 1, background: theme.inputBg, borderRadius: 10, padding: 12, border: `0.5px solid ${theme.border}` }}>
                <div style={{ fontSize: 10, color: theme.textMuted }}>DISTANCE</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: theme.textPrimary, fontFamily: 'monospace', marginTop: 4 }}>{formatDist(directDistKm)}</div>
              </div>
            </div>
            <div style={{ background: theme.inputBg, borderRadius: 10, padding: 12, border: `0.5px solid ${theme.border}`, marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: theme.textMuted, marginBottom: 8 }}>THERMAL PROFILE ACROSS ROUTE</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div><div style={{ fontSize: 9, color: theme.textMuted }}>MIN TEMP</div><div style={{ fontSize: 12, fontWeight: 700, color: theme.accentCool, fontFamily: 'monospace' }}>{formatTemp(Math.min(...journeyTemps))}</div></div>
                <div><div style={{ fontSize: 9, color: theme.textMuted }}>AVG TEMP</div><div style={{ fontSize: 12, fontWeight: 700, color: theme.textPrimary, fontFamily: 'monospace' }}>{formatTemp(journeyTemps.reduce((a: number, b: number) => a + b, 0) / journeyTemps.length)}</div></div>
                <div><div style={{ fontSize: 9, color: theme.textMuted }}>MAX TEMP</div><div style={{ fontSize: 12, fontWeight: 700, color: theme.accentHeat, fontFamily: 'monospace' }}>{formatTemp(Math.max(...journeyTemps))}</div></div>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: theme.textPrimary, marginBottom: 10 }}>How was your thermal comfort?</div>
              {ratedRoutes[activeRoute.id] ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: theme.accentCool }}>
                  <CheckCircle size={16} /><span style={{ fontSize: 13, fontWeight: 700 }}>Preference Logged ({ratedRoutes[activeRoute.id] === 'good' ? 'Liked' : 'Rejected'})</span>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <button onClick={() => handleFeedback(activeRoute.id, true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: theme.inputBg, border: `0.5px solid ${theme.accentCool}`, padding: '10px 16px', borderRadius: 10, cursor: 'pointer', color: theme.accentCool, fontSize: 13, fontWeight: 700 }}>
                    <ThumbsUp size={15} /> Good pick
                  </button>
                  <button onClick={() => handleFeedback(activeRoute.id, false)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: theme.inputBg, border: `0.5px solid ${theme.accentHeat}`, padding: '10px 16px', borderRadius: 10, cursor: 'pointer', color: theme.accentHeat, fontSize: 13, fontWeight: 700 }}>
                    <ThumbsDown size={15} /> Not for me
                  </button>
                </div>
              )}
            </div>
            <button className="calc-btn" onClick={() => { handleDiscardJourney(); setShowJourneySummary(false); }}>
              Finish & Close Route
            </button>
          </div>
        </div>
      )}

      {/* ── ML INSIGHTS MODAL ──────────────────────────────────────────────────── */}
      {showMLInsights && (
        <div className="modal-overlay" onClick={() => setShowMLInsights(false)}>
          <div className="modal-card" style={{ background: theme.sheetBg, border: `1px solid ${theme.border}` }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Brain size={18} color="#10B981" /><span style={{ fontSize: 15, fontWeight: 900, color: theme.textPrimary }}>ML Model & Shade Insights</span></div>
              <button className="modal-close" onClick={() => setShowMLInsights(false)}><X size={20} color={theme.textMuted} /></button>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: '55vh' }}>
              {[
                { label: 'MODEL ARCHITECTURE', content: 'Online SGD Logistic Regression (river / sklearn)\nUpdates one click at a time via sub-millisecond stochastic gradient descent.' },
                { label: 'CURRENT LEARNED PREFERENCE', content: `${shadePreferencePct.toFixed(1)}% Shade-Preferring`, big: true },
                { label: 'PRETRAINED SEGFORMER SHADE ANALYSIS', content: '• Key point 1 (Origins): 22% canopy shade\n• Key point 2 (Corridor): 72% tree canopy shade\n• Key point 3 (Park Entry): 84% dense shade' },
              ].map((card, i) => (
                <div key={i} style={{ background: theme.inputBg, padding: 12, borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.1)', marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>{card.label}</div>
                  <div style={{ fontSize: card.big ? 20 : 13, fontWeight: card.big ? 800 : 500, color: card.big ? '#10B981' : theme.textPrimary, whiteSpace: 'pre-line' }}>{card.content}</div>
                </div>
              ))}
              <div style={{ background: theme.inputBg, padding: 12, borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>RECENT FEEDBACK LOG ({mlHistory.length})</div>
                {mlHistory.length === 0
                  ? <span style={{ fontSize: 12, color: theme.textMuted }}>No feedback logged yet. Tap Like/Pass on route cards to train!</span>
                  : mlHistory.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, borderBottom: `0.5px solid ${theme.border}`, paddingBottom: 4 }}>
                      <span style={{ fontSize: 12, color: theme.textPrimary }}>{item.satisfied ? 'Preferred' : 'Rejected'} ({item.route_type})</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>P(sat): {item.new_prob}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SETTINGS MODAL ──────────────────────────────────────────────────────── */}
      {showSettings && (
        <div className="modal-overlay settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal" style={{ background: theme.bg, border: `1px solid ${theme.border}` }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: `1px solid ${theme.border}` }}>
              <span style={{ fontSize: 17, fontWeight: 900, color: theme.textPrimary }}>CoolPath Settings</span>
              <button className="modal-close" onClick={() => setShowSettings(false)}><X size={20} color={theme.textSecondary} /></button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <div className="settings-section-label" style={{ color: theme.textMuted }}>SI UNITS & MEASUREMENTS</div>
              {[
                { label: 'Temperature Unit', sub: 'Show values in Celsius or Fahrenheit', options: ['C', 'F'], current: tempUnit, onChange: setTempUnit },
                { label: 'Distance Unit', sub: 'Show route length in km or miles', options: ['km', 'mi'], current: distUnit, onChange: setDistUnit },
                { label: 'Appearance Mode', sub: 'Switch interface theme colors', options: ['Light', 'Dark'], current: isDark ? 'Dark' : 'Light', onChange: (v: string) => setIsDark(v === 'Dark') },
              ].map((s, i) => (
                <div key={i} className="settings-row" style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: theme.textSecondary }}>{s.sub}</div>
                  </div>
                  <div className="seg-control">
                    {s.options.map(o => (
                      <button key={o} className={`seg-btn ${s.current === o ? 'on' : ''}`}
                        style={{ background: s.current === o ? theme.accentCool : 'transparent', color: s.current === o ? (isDark ? '#0C1210' : '#fff') : theme.textMuted, border: 'none', cursor: 'pointer', padding: '5px 12px', borderRadius: 8, fontWeight: 700, fontSize: 12 }}
                        onClick={() => (s.onChange as any)(o)}>{o}</button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="settings-section-label" style={{ color: theme.textMuted, marginTop: 20 }}>ROUTING ENGINE CUSTOMIZATION</div>
              <div className="settings-row" style={{ borderBottom: `1px solid ${theme.border}` }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>Shade Coverage</div><div style={{ fontSize: 12, color: theme.textSecondary }}>Route optimization shade weighting</div></div>
                <div className="seg-control">
                  {['comfort', 'balanced', 'strict'].map(v => (
                    <button key={v} className={`seg-btn ${shadeWeight === v ? 'on' : ''}`}
                      style={{ background: shadeWeight === v ? theme.accentCool : 'transparent', color: shadeWeight === v ? (isDark ? '#0C1210' : '#fff') : theme.textMuted, border: 'none', cursor: 'pointer', padding: '5px 10px', borderRadius: 8, fontWeight: 700, fontSize: 11, textTransform: 'capitalize' }}
                      onClick={() => setShadeWeight(v as any)}>{v}</button>
                  ))}
                </div>
              </div>
              <div className="settings-row" style={{ borderBottom: `1px solid ${theme.border}` }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>Default Travel Pace</div><div style={{ fontSize: 12, color: theme.textSecondary }}>Walking/running speed modifier</div></div>
                <div className="seg-control">
                  {['slow', 'normal', 'fast'].map(v => (
                    <button key={v} className={`seg-btn ${defaultPace === v ? 'on' : ''}`}
                      style={{ background: defaultPace === v ? theme.accentCool : 'transparent', color: defaultPace === v ? (isDark ? '#0C1210' : '#fff') : theme.textMuted, border: 'none', cursor: 'pointer', padding: '5px 10px', borderRadius: 8, fontWeight: 700, fontSize: 11, textTransform: 'capitalize' }}
                      onClick={() => setDefaultPace(v as any)}>{v}</button>
                  ))}
                </div>
              </div>
              <div className="settings-row" style={{ borderBottom: `1px solid ${theme.border}` }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>Microclimate Heat Alerts</div><div style={{ fontSize: 12, color: theme.textSecondary }}>Notify when entering extreme thermal strain paths</div></div>
                <button className={`toggle-switch ${heatAlertsOn ? 'on' : ''}`} style={{ background: heatAlertsOn ? theme.accentCool : theme.border }} onClick={() => setHeatAlertsOn(p => !p)}>
                  <div className={`toggle-pin ${heatAlertsOn ? 'on' : ''}`} />
                </button>
              </div>
              <div className="settings-row" style={{ borderBottom: `1px solid ${theme.border}` }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>Default Planning Mode</div><div style={{ fontSize: 12, color: theme.textSecondary }}>Auto-optimize departure times</div></div>
                <div className="seg-control">
                  {[{ v: 'now', label: 'Now' }, { v: 'scheduled', label: 'Scheduled' }].map(o => (
                    <button key={o.v} className={`seg-btn ${defaultDepartMode === o.v ? 'on' : ''}`}
                      style={{ background: defaultDepartMode === o.v ? theme.accentCool : 'transparent', color: defaultDepartMode === o.v ? (isDark ? '#0C1210' : '#fff') : theme.textMuted, border: 'none', cursor: 'pointer', padding: '5px 10px', borderRadius: 8, fontWeight: 700, fontSize: 11 }}
                      onClick={() => setDefaultDepartMode(o.v as any)}>{o.label}</button>
                  ))}
                </div>
              </div>

              {/* Custom backend URL */}
              <div className="settings-section-label" style={{ color: theme.textMuted, marginTop: 20 }}>BACKEND CONFIGURATION</div>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary, marginBottom: 4 }}>Custom Backend URL</div>
                <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8 }}>Override the default server endpoint (e.g. ngrok or local)</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={customBackendUrl} onChange={e => setCustomBackendUrl(e.target.value)} placeholder="https://your-backend.ngrok.io"
                    style={{ flex: 1, background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '8px 12px', color: theme.textPrimary, fontSize: 13 }} />
                  <button onClick={saveCustomUrl} style={{ background: theme.accentCool, border: 'none', borderRadius: 8, padding: '8px 14px', color: isDark ? '#0C1210' : '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Save</button>
                  {customBackendUrl && <button onClick={() => { setCustomBackendUrl(''); localStorage.removeItem('custom_backend_url'); }} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 10px', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>}
                </div>
              </div>

              <div className="settings-section-label" style={{ color: theme.textMuted, marginTop: 20 }}>INFORMATION & LEGAL</div>
              {[
                { icon: <Info size={15} color="#38bdf8" />, label: 'About CoolPath', section: 'about' },
                { icon: <FlaskConical size={15} color="#2DD9B8" />, label: 'Scientific Research & Physics', section: 'science' },
                { icon: <FileText size={15} color="#fbbf24" />, label: 'Terms and Conditions', section: 'terms' },
                { icon: <Lock size={15} color="#a78bfa" />, label: 'Privacy Policy', section: 'privacy' },
              ].map(item => (
                <button key={item.section} className="settings-row legal-row" style={{ borderBottom: `1px solid ${theme.border}`, background: 'none', border: 'none', width: '100%', cursor: 'pointer', borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: theme.border }}
                  onClick={() => setShowAbout(item.section as any)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{item.icon}<span style={{ fontSize: 14, color: theme.textPrimary, fontWeight: 500 }}>{item.label}</span></div>
                  <ChevronRight size={15} color={theme.textMuted} />
                </button>
              ))}
              <div style={{ textAlign: 'center', padding: '24px 20px' }}>
                <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700 }}>COOLPATH NAVIGATION SYSTEM</div>
                <div style={{ fontSize: 9, color: theme.textMuted, marginTop: 4 }}>Version 1.2.0-Production</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ABOUT/LEGAL MODAL ────────────────────────────────────────────────── */}
      {showAbout && (
        <div className="modal-overlay" onClick={() => setShowAbout(null)}>
          <div className="settings-modal" style={{ background: theme.bg, border: `1px solid ${theme.border}`, marginTop: '15%', maxHeight: '70vh' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: `1px solid ${theme.border}` }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: theme.textPrimary }}>
                {showAbout === 'about' ? 'About CoolPath' : showAbout === 'science' ? 'Scientific Research & Physics' : showAbout === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
              </span>
              <button className="modal-close" onClick={() => setShowAbout(null)}><ChevronDown size={18} color={theme.textSecondary} /></button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
              {showAbout === 'about' && (
                <>
                  <h3 style={{ color: theme.textPrimary, fontSize: 16, marginBottom: 12 }}>CoolPath Navigation</h3>
                  <p style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>CoolPath is a state-of-the-art urban navigation engine designed to combat extreme heat index risks inside major cities. Powered by real-time microclimate sensors and shade canopy datasets, CoolPath calculates walking, running, and biking paths optimized to avoid sun-exposed hot asphalt and maximize shade comfort.</p>
                  <p style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 1.6 }}>Designed with support from urban planning agencies, meteorology specialists, and animal comfort panels.</p>
                </>
              )}
              {showAbout === 'science' && (
                <>
                  <h3 style={{ color: theme.textPrimary, fontSize: 16, marginBottom: 12 }}>Thermodynamics & Human Bio-Physics</h3>
                  {[
                    { title: '1. FIRST LAW OF THERMODYNAMICS', body: 'Human thermal balance follows internal heat accumulation: Q_stored = Q_metabolic - Q_work - Q_convection - Q_radiation - Q_evaporation. CoolPath calculates edge-level metabolic expenditure (METs) and wind convective cooling to maintain core body stability (37.0°C baseline).' },
                    { title: '2. STEFAN-BOLTZMANN RADIATIVE HEAT TRANSFER', body: 'Sunlit urban pavement emits thermal radiation proportional to T⁴. Direct asphalt temperatures frequently exceed 55°C (131°F), transferring severe radiative heat flux to human tissue and pet paws. CoolPath\'s tree canopy algorithm reduces direct solar thermal load by up to 85%.' },
                    { title: '3. LEWIS RELATION & LATENT EVAPORATIVE LIMITS', body: 'Sweat evaporation efficiency is governed by ambient relative humidity and saturation pressure. CoolPath evaluates local atmospheric moisture to warn users when high humidity inhibits natural sweat evaporation, preventing heat exhaustion.' },
                    { title: '4. FORTYGUARD SPATIAL HEAT INDEXING', body: 'Utilizes sub-meter thermal satellite rasters and STRtree point-in-polygon spatial indexing to calculate street segment microclimates with sub-millisecond query latency.' },
                  ].map((s, i) => (
                    <div key={i} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, color: '#2DD9B8', fontWeight: 800, marginBottom: 4 }}>{s.title}</div>
                      <p style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 1.6, margin: 0 }}>{s.body}</p>
                    </div>
                  ))}
                </>
              )}
              {showAbout === 'terms' && (
                <>
                  <h3 style={{ color: theme.textPrimary, fontSize: 16, marginBottom: 12 }}>Terms of Service</h3>
                  <p style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>By using CoolPath, you agree to these terms. CoolPath provides heat-aware routes for navigational support. Thermal forecasts, microclimate analysis, and air quality indexes are model estimations. Always exercise personal safety, carry hydration, and take indoor shelter during extreme municipal heat warnings.</p>
                  <p style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 1.6 }}>Users assume all risks associated with outdoor walking and navigation.</p>
                </>
              )}
              {showAbout === 'privacy' && (
                <>
                  <h3 style={{ color: theme.textPrimary, fontSize: 16, marginBottom: 12 }}>Privacy Policy</h3>
                  <p style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>CoolPath respects user privacy. Your current GPS position, planned origins, and destinations are processed locally on the client or sent securely to local route calculation proxies. We do not store, sell, or rent your precise historical travel locations.</p>
                  <p style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 1.6 }}>Cached history is saved solely on your device's localStorage sandbox.</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── VOICE ASSISTANT MODAL ──────────────────────────────────────────────── */}
      <VoiceAssistantModal
        visible={showAssistant}
        onClose={() => setShowAssistant(false)}
        currentOriginText={originText}
        currentDestText={destText}
        liveTempC={liveWeather.tempC ?? 32}
        liveAqi={liveWeather.aqi ?? 42}
        onPlanRouteAction={handlePlanRouteAction}
        isDark={isDark}
        theme={theme}
      />
    </div>
  );
}
>>>>>>> Stashed changes
