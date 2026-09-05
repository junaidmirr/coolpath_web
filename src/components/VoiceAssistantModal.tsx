import React, { useState, useEffect, useRef } from 'react';
import { callAssistantBackend, transcribeAudio, fetchPollyTTSAudio } from '../services/api';
import type { AssistantChatMessage, AssistantChatContext } from '../types/mission';
import { Mic, MicOff, Volume2, VolumeX, X, Sparkles } from 'lucide-react';

interface VoiceAssistantModalProps {
  visible: boolean;
  onClose: () => void;
  currentOriginText: string;
  currentDestText: string;
  liveTempC: number | null;
  liveAqi: number | null;
  pendingAction?: any;
  setPendingAction?: (action: any) => void;
  onPlanRouteAction: (orig: string, dest: string, act?: string, paceArg?: string, modeArg?: string) => void;
  isDark?: boolean;
  theme?: any;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  visible,
  onClose,
  currentOriginText,
  currentDestText,
  liveTempC,
  liveAqi,
  pendingAction,
  setPendingAction,
  onPlanRouteAction,
}) => {
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [assistantState, setAssistantState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  const isListeningRef = useRef(false);
  const isThinkingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const micVolumeRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // preloaded audio sound assets (encoded or synth)
  const playSoundEffect = (type: 'ready' | 'start' | 'close') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'ready') {
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(840, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(0);
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'start') {
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(0);
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'close') {
        osc.frequency.setValueAtTime(450, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start(0);
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {}
  };

  // Scroll to bottom
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, liveTranscript]);

  const visibleRef = useRef(visible);
  const isExecutingRouteRef = useRef(false);

  useEffect(() => {
    visibleRef.current = visible;
    if (visible) {
      isExecutingRouteRef.current = false;
      setMessages([
        {
          role: 'assistant',
          content: "Hi! I'm CoolPath Assistant. Where would you like to go today?",
          display_text: "**Hi! I'm CoolPath Assistant.**\n\nWhere would you like to go today?",
          timestamp: Date.now()
        }
      ]);
      speakText("Hi! I'm CoolPath Assistant. Where would you like to go today?");
      playSoundEffect('ready');
    } else {
      stopAll();
    }
    return () => stopAll();
  }, [visible]);

  // Canvas visualizer loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rotation = 0;
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || 250;
      canvas.height = canvas.parentElement?.clientHeight || 250;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      rotation += 0.02;

      const state = isThinkingRef.current
        ? 'thinking'
        : isListeningRef.current
        ? 'listening'
        : isSpeakingRef.current
        ? 'speaking'
        : 'idle';

      ctx.save();
      if (state === 'idle') {
        // Red glowing pulsing core
        const r = 40 + Math.sin(Date.now() * 0.003) * 3;
        const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
        grad.addColorStop(0, 'rgba(239, 68, 68, 0.85)');
        grad.addColorStop(0.5, 'rgba(16, 185, 129, 0.25)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

      } else if (state === 'listening') {
        // Dynamic green reactive circles using real mic volume input
        const vol = micVolumeRef.current;
        const baseRadius = 45 + vol * 0.5;

        for (let i = 0; i < 3; i++) {
          const shift = i * Math.PI / 1.5 + rotation * (1 + i * 0.2);
          ctx.strokeStyle = i === 0 ? 'rgba(16, 185, 129, 0.75)' : i === 1 ? 'rgba(56, 189, 248, 0.65)' : 'rgba(99, 102, 241, 0.65)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
            const radNoise = Math.sin(angle * 6 + shift) * (6 + vol * 0.12);
            const r = baseRadius + radNoise;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (angle === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        }

        const grad = ctx.createRadialGradient(cx, cy, baseRadius * 0.1, cx, cy, baseRadius * 0.5);
        grad.addColorStop(0, 'rgba(16, 185, 129, 0.8)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius * 0.5, 0, Math.PI * 2);
        ctx.fill();

      } else if (state === 'thinking') {
        // Rotating purple/indigo spiral portal
        const r = 50;
        ctx.translate(cx, cy);
        ctx.rotate(rotation * 1.2);
        const grad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
        grad.addColorStop(0, 'rgba(168, 85, 247, 0.9)');
        grad.addColorStop(0.5, 'rgba(99, 102, 241, 0.4)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(236, 72, 153, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let angle = 0; angle < Math.PI * 2; angle += 0.08) {
          const rad = r * 0.8 + Math.cos(angle * 7 + rotation * 5) * 4;
          ctx.lineTo(Math.cos(angle) * rad, Math.sin(angle) * rad);
        }
        ctx.closePath();
        ctx.stroke();

      } else if (state === 'speaking') {
        // Bouncing sky-blue voice frequency waves
        const baseRadius = 50 + Math.sin(Date.now() * 0.012) * 6;
        for (let i = 0; i < 2; i++) {
          const shift = i * Math.PI + rotation * 2;
          ctx.strokeStyle = i === 0 ? 'rgba(56, 189, 248, 0.7)' : 'rgba(236, 72, 153, 0.5)';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
            const radNoise = Math.sin(angle * 8 + shift) * 10;
            const r = baseRadius + radNoise;
            ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
      ctx.restore();

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const speechRecognitionRef = useRef<any>(null);
  const speechCapturedTextRef = useRef<string>('');

  const startListening = async () => {
    if (isThinkingRef.current || isSpeakingRef.current) return;
    if (isListeningRef.current) return;

    stopAudioPlayback();
    setLiveTranscript('');
    playSoundEffect('start');
    speechCapturedTextRef.current = '';

    // 1. Try Browser Native SpeechRecognition (instant live speech-to-text)
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    let webSpeechActive = false;

    if (SpeechRecognitionClass) {
      try {
        const rec = new SpeechRecognitionClass();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onresult = (event: any) => {
          let interim = '';
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              final += transcript;
            } else {
              interim += transcript;
            }
          }
          if (final) speechCapturedTextRef.current += ' ' + final;
          const showText = (speechCapturedTextRef.current + ' ' + interim).trim();
          if (showText) {
            setLiveTranscript(showText);
          }
        };

        rec.onerror = (e: any) => {
          console.warn('SpeechRecognition error:', e);
        };

        rec.onend = () => {
          const text = speechCapturedTextRef.current.trim();
          if (text && isListeningRef.current) {
            isListeningRef.current = false;
            isThinkingRef.current = true;
            setAssistantState('thinking');
            submitUserPrompt(text);
          }
        };

        speechRecognitionRef.current = rec;
        rec.start();
        webSpeechActive = true;
      } catch (e) {
        console.warn('SpeechRecognition failed to start:', e);
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      isListeningRef.current = true;
      setAssistantState('listening');

      // Setup Web Audio Analyser for volume indicator
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 32;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkVolume = () => {
        if (!isListeningRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        micVolumeRef.current = Math.max(0, avg);
        requestAnimationFrame(checkVolume);
      };
      checkVolume();

      // Record audio for fallback
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // If Web Speech already captured text, use that!
        const webText = speechCapturedTextRef.current.trim();
        if (webText) {
          isThinkingRef.current = true;
          setAssistantState('thinking');
          submitUserPrompt(webText);
          return;
        }

        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const base64 = await convertBlobToBase64(blob);
          
          isThinkingRef.current = true;
          setAssistantState('thinking');
          setLiveTranscript('Transcribing audio...');

          const text = await transcribeAudio(base64, 'audio/webm');
          if (text && text.trim()) {
            submitUserPrompt(text.trim());
          } else {
            handleNoSpeech();
          }
        } else {
          handleNoSpeech();
        }
      };

      mediaRecorder.start(250);

      // Auto-stop recording after 8 seconds
      setTimeout(() => {
        if (isListeningRef.current) {
          stopListening();
        }
      }, 8000);

    } catch (err) {
      console.warn('Microphone access failed:', err);
      if (!webSpeechActive) handleNoSpeech();
    }
  };

  const stopListening = () => {
    if (!isListeningRef.current) return;
    isListeningRef.current = false;
    setAssistantState('idle');
    micVolumeRef.current = 0;

    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch {}
      speechRecognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  };

  const handleNoSpeech = () => {
    isThinkingRef.current = false;
    setAssistantState('idle');
    setLiveTranscript('');
    const errMsg: AssistantChatMessage = {
      role: 'assistant',
      content: "I didn't quite catch that. Could you please repeat?",
      display_text: "**No speech detected**\n\nI couldn't hear you clearly. Please try again or type below.",
      suggested_replies: ['Plan route to Central Park', 'Check weather'],
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, errMsg]);
    speakText("I didn't quite catch that. Could you please repeat?");
  };

  const convertBlobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const submitUserPrompt = async (text: string) => {
    const userMsg: AssistantChatMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLiveTranscript('');
    setAssistantState('thinking');
    isThinkingRef.current = true;

    const context: AssistantChatContext = {
      current_origin: currentOriginText,
      current_dest: currentDestText,
      temp_c: liveTempC ?? 32,
      aqi: liveAqi ?? 42,
      pending_action: pendingAction,
    };

    try {
      const response = await callAssistantBackend(
        updatedMessages.map(m => ({ role: m.role, content: m.content })),
        context
      );

      isThinkingRef.current = false;
      setAssistantState('idle');

      const assistantMsg: AssistantChatMessage = {
        role: 'assistant',
        content: response.spoken_response,
        display_text: response.display_text,
        action: response.action,
        action_data: response.action_data,
        suggested_replies: response.suggested_replies || [],
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMsg]);

      let routeToExecute: any = null;
      if (response.action_data || response.action === 'confirm_route' || response.action === 'execute_route') {
        const actionData = response.action_data || {
          origin: currentOriginText,
          destination: currentDestText,
          activity: 'walking'
        };

        if (response.action === 'execute_route') {
          routeToExecute = actionData;
        } else if (setPendingAction) {
          setPendingAction(actionData);
        }
      }

      if (routeToExecute) {
        isExecutingRouteRef.current = true;
        stopAll();
        onPlanRouteAction(
          routeToExecute.origin,
          routeToExecute.destination,
          routeToExecute.activity || 'walking',
          routeToExecute.pace || 'normal',
          routeToExecute.planning_mode || 'instant'
        );
        onClose();
        return;
      }

      speakText(response.spoken_response);

    } catch (err) {
      isThinkingRef.current = false;
      setAssistantState('idle');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm having trouble connecting to the server.",
        display_text: "**Connection Error**\n\nCould not connect to CoolPath backend.",
        timestamp: Date.now()
      }]);
    }
  };

  const speakText = async (text: string, onFinish?: () => void) => {
    stopListening();
    if (isMuted || !text || !visibleRef.current || isExecutingRouteRef.current) {
      setAssistantState('idle');
      onFinish?.();
      return;
    }

    setAssistantState('speaking');
    isSpeakingRef.current = true;

    try {
      const base64Audio = await fetchPollyTTSAudio(text, 'Salli', 'standard');
      if (base64Audio) {
        const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
        ttsAudioRef.current = audio;
        audio.onended = () => {
          isSpeakingRef.current = false;
          setAssistantState('idle');
          onFinish?.();
          
          // Continuous Loop trigger: only resume if visible and not executing route
          setTimeout(() => {
            if (!isMuted && visibleRef.current && !isExecutingRouteRef.current) {
              startListening();
            }
          }, 350);
        };
        audio.onerror = () => {
          isSpeakingRef.current = false;
          setAssistantState('idle');
          onFinish?.();
        };
        audio.play().catch(() => {
          isSpeakingRef.current = false;
          setAssistantState('idle');
          onFinish?.();
        });
      } else {
        // Web Speech synthesis fallback
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(text);
          utter.onend = () => {
            isSpeakingRef.current = false;
            setAssistantState('idle');
            onFinish?.();
            setTimeout(() => {
              if (!isMuted && visibleRef.current && !isExecutingRouteRef.current) startListening();
            }, 350);
          };
          window.speechSynthesis.speak(utter);
        } else {
          isSpeakingRef.current = false;
          setAssistantState('idle');
          onFinish?.();
        }
      }
    } catch {
      isSpeakingRef.current = false;
      setAssistantState('idle');
      onFinish?.();
    }
  };

  const stopAudioPlayback = () => {
    if (ttsAudioRef.current) {
      try { ttsAudioRef.current.pause(); } catch {}
      ttsAudioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;
  };

  const stopAll = () => {
    stopListening();
    stopAudioPlayback();
    isThinkingRef.current = false;
    setAssistantState('idle');
    setLiveTranscript('');
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 11, 20, 0.85)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px',
    }}>
      {/* Immersive Glass Card Container */}
      <div style={{
        width: '100%',
        maxWidth: '520px',
        height: '90vh',
        background: 'linear-gradient(145deg, rgba(13, 27, 42, 0.7) 0%, rgba(5, 11, 20, 0.9) 100%)',
        border: '1.5px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        boxShadow: '0 16px 40px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Glowing Ambient light overlay */}
        <div style={{
          position: 'absolute',
          top: '-150px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: assistantState === 'listening' 
            ? 'rgba(16, 185, 129, 0.15)' 
            : assistantState === 'thinking' 
            ? 'rgba(168, 85, 247, 0.15)' 
            : 'rgba(56, 189, 248, 0.15)',
          filter: 'blur(100px)',
          pointerEvents: 'none',
          zIndex: 0
        }} />

        {/* Header Bar */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 10px #10b981'
            }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', letterSpacing: '1px' }}>
              LIVE SESSION
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                if (!isMuted) stopAll();
                setIsMuted(!isMuted);
              }}
              style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)', border: 'none',
                color: isMuted ? '#ef4444' : '#10b981', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s'
              }}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button
              onClick={onClose}
              style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)', border: 'none',
                color: '#94a3b8', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Chat Bubbles List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          zIndex: 1
        }}>
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: msg.role === 'user' ? 'rgba(37, 99, 235, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                border: msg.role === 'user' 
                  ? '1px solid rgba(37, 99, 235, 0.3)' 
                  : '1px solid rgba(255, 255, 255, 0.08)',
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                color: '#e2e8f0',
                fontSize: '14px',
                lineHeight: 1.5,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              {msg.role === 'assistant' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px', color: '#10b981' }}>
                  <Sparkles size={12} />
                  <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px' }}>COOLPATH AI</span>
                </div>
              )}
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </div>
            </div>
          ))}

          {/* Live Transcript bubble */}
          {liveTranscript && (
            <div style={{
              alignSelf: 'flex-end',
              maxWidth: '85%',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px dashed rgba(255, 255, 255, 0.15)',
              padding: '12px 16px',
              borderRadius: '18px 18px 4px 18px',
              color: '#94a3b8',
              fontSize: '14px',
              fontStyle: 'italic'
            }}>
              {liveTranscript}
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Suggested Quick Replies */}
        {messages.length > 0 && messages[messages.length - 1].suggested_replies && (
          <div style={{
            padding: '10px 20px',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            zIndex: 10
          }}>
            {messages[messages.length - 1].suggested_replies?.map((reply, i) => (
              <button
                key={i}
                onClick={() => submitUserPrompt(reply)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#38bdf8',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        {/* Canvas Visualizer Panel & Mic Trigger Button */}
        <div style={{
          padding: '24px 20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          zIndex: 10
        }}>
          {/* Waveform orb wrapper */}
          <div style={{
            width: '240px',
            height: '100px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%', maxWidth: '360px', justifyContent: 'center' }}>
            <button
              onClick={() => {
                if (assistantState === 'listening') {
                  stopListening();
                } else {
                  startListening();
                }
              }}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: assistantState === 'listening' ? '#ef4444' : '#10b981',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: assistantState === 'listening' ? '0 0 20px rgba(239,68,68,0.4)' : '0 0 20px rgba(16,185,129,0.4)',
                transition: 'all 0.2s'
              }}
            >
              {assistantState === 'listening' ? <MicOff size={24} /> : <Mic size={24} />}
            </button>

            <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>
              {assistantState === 'listening' 
                ? 'Listening... Speak now' 
                : assistantState === 'thinking' 
                ? 'Thinking...' 
                : assistantState === 'speaking' 
                ? 'Speaking...' 
                : 'Tap mic to speak'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
