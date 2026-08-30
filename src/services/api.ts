import axios from 'axios';
import type { MissionRequest, MissionResponse } from '../types/mission';

// Live production backend on Google Cloud Run
const GCP_BACKEND_URL = (import.meta as any).env?.VITE_GCP_BACKEND_URL || 'https://coolpath-806112833144.europe-west1.run.app';
const ENV_API_URL: string | undefined = (import.meta as any).env?.VITE_API_URL;

const CANDIDATE_URLS = [
  ENV_API_URL,
  GCP_BACKEND_URL,
  'http://localhost:8000',
  'http://localhost:8001',
  'http://localhost:8002',
  'http://localhost:8003',
  'http://localhost:8004',
].filter(Boolean) as string[];

let activeBaseUrl: string | null = ENV_API_URL || null;

export interface BackendStatus {
  online: boolean;
  url: string | null;
  port: number | null;
  demoMode?: boolean;
}

export const checkBackendHealth = async (): Promise<BackendStatus> => {
  const customUrl = localStorage.getItem('custom_backend_url');
  const urlToTest = activeBaseUrl || customUrl;

  if (urlToTest) {
    try {
      const res = await axios.get(`${urlToTest}/health`, { timeout: 2500 });
      if (res.data?.status === 'ok') {
        activeBaseUrl = urlToTest;
        const portMatch = urlToTest.match(/:(\d+)/);
        return {
          online: true,
          url: urlToTest,
          port: portMatch ? parseInt(portMatch[1]) : null,
          demoMode: res.data?.demo_mode
        };
      }
    } catch {
      activeBaseUrl = null; // Cache invalidated
    }
  }

  // Probe in parallel
  const probePromises = CANDIDATE_URLS.map(async (url) => {
    try {
      const res = await axios.get(`${url}/health`, { timeout: 3000 });
      if (res.data?.status === 'ok') {
        const portMatch = url.match(/:(\d+)/);
        return {
          url,
          port: portMatch ? parseInt(portMatch[1]) : null,
          demoMode: res.data?.demo_mode
        };
      }
    } catch {}
    return null;
  });

  const results = await Promise.all(probePromises);
  const active = results.find(r => r !== null);

  if (active) {
    activeBaseUrl = active.url;
    return {
      online: true,
      url: active.url,
      port: active.port,
      demoMode: active.demoMode
    };
  }

  return {
    online: false,
    url: null,
    port: null
  };
};

export const getActiveBaseUrl = async (): Promise<string> => {
  if (activeBaseUrl) return activeBaseUrl;
  const status = await checkBackendHealth();
  if (status.online && status.url) {
    return status.url;
  }
  return GCP_BACKEND_URL;
};

export const planMission = async (request: MissionRequest): Promise<MissionResponse> => {
  const baseUrl = await getActiveBaseUrl();
  const response = await axios.post(`${baseUrl}/api/mission`, request, {
    timeout: 120000
  });
  return response.data;
};

export const parseUserIntent = async (prompt: string) => {
  const baseUrl = await getActiveBaseUrl();
  const response = await axios.post(`${baseUrl}/api/parse-intent`, { prompt }, {
    timeout: 15000
  });
  return response.data;
};

export const resetActiveBaseUrl = () => {
  activeBaseUrl = null;
};

export const callAssistantBackend = async (
  messages: { role: string; content: string }[],
  context: any
): Promise<any> => {
  const baseUrl = await getActiveBaseUrl();
  try {
    const response = await axios.post(
      `${baseUrl}/api/assistant/chat`,
      { messages, context },
      { timeout: 30000 }
    );
    if (response.data && response.data.data) {
      return response.data.data;
    }
    throw new Error('Invalid response structure from assistant API');
  } catch (error: any) {
    if (error.response?.status === 503) {
      resetActiveBaseUrl();
      const newBaseUrl = await getActiveBaseUrl();
      if (newBaseUrl && newBaseUrl !== baseUrl) {
        try {
          const retryRes = await axios.post(
            `${newBaseUrl}/api/assistant/chat`,
            { messages, context },
            { timeout: 30000 }
          );
          if (retryRes.data && retryRes.data.data) {
            return retryRes.data.data;
          }
        } catch (retryErr) {}
      }
    }
    return {
      spoken_response: "I'm ready to help you navigate through shaded, cooler urban corridors. Where would you like to go?",
      display_text: "I can help you navigate cities while avoiding extreme heat and high asphalt temperatures.\n\nWhere would you like to go?",
      action: null,
      action_data: null,
      suggested_replies: ["Go to Central Park", "Times Square to Brooklyn", "Check Weather"],
    };
  }
};

export const transcribeAudio = async (audioBase64: string, mimeType: string = 'audio/webm'): Promise<string> => {
  const baseUrl = await getActiveBaseUrl();
  try {
    const response = await axios.post(
      `${baseUrl}/api/assistant/transcribe`,
      { audio_base64: audioBase64, mime_type: mimeType },
      { timeout: 20000 }
    );
    return response.data?.transcript || '';
  } catch (err) {
    console.warn('[VoiceAssistant transcribe error]', err);
    return '';
  }
};

export const fetchPollyTTSAudio = async (text: string, voiceId: string = 'Salli', engine: string = 'standard'): Promise<string | null> => {
  const baseUrl = await getActiveBaseUrl();
  try {
    const response = await axios.post(
      `${baseUrl}/api/assistant/tts`,
      { text, voice_id: voiceId, engine },
      { timeout: 15000 }
    );
    return response.data?.status === 'ok' ? response.data.audio_base64 : null;
  } catch (err) {
    console.warn('[Polly TTS error]', err);
    return null;
  }
};

export const submitRouteFeedback = async (
  routeType: string,
  satisfied: boolean,
  context: any = {}
): Promise<{ status: string; shade_preference_percentage: number; new_predicted_satisfaction?: number }> => {
  const baseUrl = await getActiveBaseUrl();
  try {
    const response = await axios.post(
      `${baseUrl}/api/feedback`,
      { route_type: routeType, satisfied, context },
      { timeout: 10000 }
    );
    return response.data;
  } catch (error: any) {
    console.warn('[Feedback API notice]', error.message);
    return { status: 'fallback', shade_preference_percentage: 65.0 };
  }
};

export const fetchMLStats = async (): Promise<{ status: string; shade_preference_percentage: number; history: any[]; is_bootstrapped: boolean }> => {
  const baseUrl = await getActiveBaseUrl();
  try {
    const response = await axios.get(`${baseUrl}/api/ml/stats`, {
      timeout: 8000
    });
    return response.data;
  } catch (error: any) {
    return { status: 'offline', shade_preference_percentage: 65.0, history: [], is_bootstrapped: true };
  }
};

export const fetchSmartSearchSuggestions = async (
  query: string,
  originLat: number,
  originLng: number
): Promise<any[]> => {
  if (!query || query.trim().length < 2) return [];
  try {
    const baseUrl = await getActiveBaseUrl();
    const response = await axios.post(
      `${baseUrl}/api/smart-search`,
      { query: query.trim(), origin_lat: originLat, origin_lng: originLng },
      { timeout: 8000 }
    );
    return Array.isArray(response.data?.results) ? response.data.results : [];
  } catch (error: any) {
    console.warn('[SmartSearch API notice]', error.message);
    return [];
  }
};
