'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Lang } from './i18n';
import {
  TH_FIRST_MESSAGE,
  TH_PRONUNCIATION_LOCK,
  TH_SPOKEN_COMPANY,
  TH_SPOKEN_SUNNY,
  TH_VOICE_CHUNK_PLAN,
} from './voice-pronunciation';

/**
 * Voice session hook.
 *
 * Wraps the browser voice SDK so the rest of the UI only ever sees VARA
 * concepts: status, audio levels, turns, and a lead-captured signal. The SDK
 * is imported lazily on first use because it touches `window`.
 */

export type CallStatus =
  | 'idle'
  | 'requesting-mic'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'ended'
  | 'error';

export type Turn = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  final: boolean;
};

/**
 * Live audio levels, deliberately held in a ref rather than React state.
 *
 * These update at 60fps. Routing them through useState would re-render the
 * whole tree sixty times a second; the canvas reads this object directly from
 * inside its own animation loop instead.
 */
export type AudioLevels = {
  /** Visitor's microphone, 0..1, smoothed RMS. */
  user: number;
  /** Assistant's output level, 0..1, reported by the voice session. */
  agent: number;
  /** Visitor's mic split into bass / mid / treble, each 0..1. */
  bands: [number, number, number];
};

export type VaraError =
  | { kind: 'mic-denied' }
  | { kind: 'not-configured' }
  | { kind: 'connection'; detail?: string };

type Config = {
  publicKey: string | null;
  assistants: { en: string | null; th: string | null };
  textChatEnabled: boolean;
  configured: boolean;
  tenant?: {
    slug: string;
    assistantName: string;
    companyName: string;
    clientSkills: string;
    extraInstructions: string;
    website?: string;
    logoUrl?: string;
    active?: boolean;
    pausedMessage?: string;
    skills?: { title: string; body: string }[];
  } | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type VapiInstance = any;

let turnSeq = 0;
const nextId = () => `t${(turnSeq += 1)}`;

/**
 * Flatten the shapes Vapi/Daily put on `error` events into one searchable string.
 * The SDK wraps Daily failures as `{ type, error: { message, errorMsg } }`.
 */
function errorText(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err !== 'object') return String(err);

  const o = err as Record<string, unknown>;
  const parts: string[] = [];
  const take = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) parts.push(value);
  };
  take(o.type);
  take(o.stage);
  take(o.message);
  take(o.errorMsg);
  take(o.errorDetail);
  take(o.reason);
  if (typeof o.error === 'string') take(o.error);
  else if (o.error && typeof o.error === 'object') {
    const nested = errorText(o.error);
    if (nested) parts.push(nested);
  }
  if (!parts.length) {
    try {
      const json = JSON.stringify(err, Object.getOwnPropertyNames(err as object));
      if (json && json !== '{}') return json;
    } catch {
      /* ignore */
    }
  }
  return parts.join(' ');
}

/** Daily ejects everyone when a Vapi call ends. That is a hangup, not a network failure. */
function isBenignHangup(err: unknown): boolean {
  const text = errorText(err).toLowerCase();
  return (
    text.includes('ejection') ||
    text.includes('ejected') ||
    text.includes('meeting has ended') ||
    text.includes('meeting-ended') ||
    text.includes('meeting ended')
  );
}

/** Drop TTS extras if Vapi rejects the Thai voice plan, so the call still connects. */
async function startWithFallback(
  vapi: VapiInstance,
  assistantId: string,
  overrides: Record<string, unknown>,
  lang: Lang,
): Promise<unknown> {
  const tryStart = async (next: Record<string, unknown>) => {
    const call = await vapi.start(assistantId, next);
    if (call) return call;
    throw new Error('voice session unavailable');
  };

  try {
    return await tryStart(overrides);
  } catch (err) {
    if (lang !== 'th' || isBenignHangup(err)) throw err;
    console.warn('[vara] start with TTS plan failed, retrying simpler Thai session', err);
  }

  const voice = overrides.voice as Record<string, unknown> | undefined;
  if (voice && 'chunkPlan' in voice) {
    const { chunkPlan: _chunkPlan, ...voiceRest } = voice;
    try {
      return await tryStart({ ...overrides, voice: voiceRest });
    } catch (err) {
      if (isBenignHangup(err)) throw err;
      console.warn('[vara] start with Thai voice override failed, retrying assistant defaults', err);
    }
  }

  const { transcriber: _t, voice: _v, ...base } = overrides;
  return tryStart(base);
}

function parseToolArgs(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

/** Pull capture_lead arguments out of the various Vapi client message shapes. */
function captureLeadArgs(message: Record<string, unknown>): Record<string, unknown> | null {
  const lists = [message.toolCallList, message.toolCalls];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const item = (entry ?? {}) as Record<string, unknown>;
      const fn = (item.function ?? {}) as Record<string, unknown>;
      const name = String(item.name ?? fn.name ?? '');
      if (name !== 'capture_lead') continue;
      return parseToolArgs(item.arguments ?? fn.arguments ?? item.parameters);
    }
  }
  const fnCall = (message.functionCall ?? {}) as Record<string, unknown>;
  if (fnCall.name === 'capture_lead') {
    return parseToolArgs(fnCall.parameters ?? fnCall.arguments);
  }
  return null;
}

export function useVara(lang: Lang, opts?: { slug?: string }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [status, setStatus] = useState<CallStatus>('idle');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<VaraError | null>(null);
  const [muted, setMuted] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);

  const audioRef = useRef<AudioLevels>({ user: 0, agent: 0, bands: [0, 0, 0] });

  const vapiRef = useRef<VapiInstance | null>(null);
  const activeRef = useRef(false);
  // A question clicked before the call was live, replayed once Vara connects.
  const pendingRef = useRef<string | null>(null);

  // Current call id and language, for the client-side lead save below.
  const callIdRef = useRef<string | undefined>(undefined);
  const langRef = useRef(lang);
  langRef.current = lang;
  // Bumped on stop/start so an in-flight start (mic prompt) cannot connect
  // the previous language after the visitor taps TH/EN.
  const sessionGenRef = useRef(0);
  const slugRef = useRef(opts?.slug);
  slugRef.current = opts?.slug;

  // Microphone analysis chain; torn down with the call.
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterRafRef = useRef(0);

  /* ------------------------------------------------------------- config */

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/config${opts?.slug ? `?slug=${encodeURIComponent(opts.slug)}` : ''}`)
      .then((res) => res.json())
      .then((data: Config) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => {
        if (!cancelled) {
          setConfig({
            publicKey: null,
            assistants: { en: null, th: null },
            textChatEnabled: true,
            configured: false,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [opts?.slug]);

  /* -------------------------------------------------------- transcripts */

  const pushTranscript = useCallback(
    (role: 'user' | 'assistant', text: string, final: boolean) => {
      const clean = text.trim();
      if (!clean) return;

      setTurns((prev) => {
        const last = prev[prev.length - 1];

        // Extend the in-progress turn from the same speaker.
        if (last && last.role === role && !last.final) {
          const updated = [...prev];
          updated[updated.length - 1] = { ...last, text: clean, final };
          return updated;
        }

        return [...prev, { id: nextId(), role, text: clean, final }];
      });
    },
    []
  );

  /* ------------------------------------------------------- mic metering */

  /**
   * Tap the visitor's microphone with an AnalyserNode, so the interface can
   * react to *them* speaking and not only to the assistant.
   *
   * The session SDK reports its own output level and nothing else, so this is
   * the only way to tell the two voices apart. Best-effort: if any of it
   * fails, the call still works and the visual simply falls back to
   * assistant-driven motion.
   */
  const startMeter = useCallback((stream: MediaStream) => {
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;

      const ctx = new Ctor();
      audioCtxRef.current = ctx;
      // start() runs from a click, so resuming here is permitted.
      if (ctx.state === 'suspended') void ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      // Deliberately NOT connected to ctx.destination — that would echo the
      // visitor's own voice back at them through the speakers.

      const timeData = new Uint8Array(analyser.fftSize);
      const freqData = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        meterRafRef.current = requestAnimationFrame(tick);

        analyser.getByteTimeDomainData(timeData);
        let sumSquares = 0;
        for (let i = 0; i < timeData.length; i += 1) {
          const v = (timeData[i] - 128) / 128;
          sumSquares += v * v;
        }
        // Conversational speech sits around 0.02–0.20 RMS.
        const level = Math.min(1, Math.sqrt(sumSquares / timeData.length) * 6);

        const a = audioRef.current;
        // Fast attack, slow release — reads as speech rather than as noise.
        a.user += (level - a.user) * (level > a.user ? 0.5 : 0.12);

        analyser.getByteFrequencyData(freqData);
        const n = freqData.length;
        const band = (from: number, to: number) => {
          let sum = 0;
          for (let i = from; i < to; i += 1) sum += freqData[i];
          return Math.min(1, sum / Math.max(1, to - from) / 170);
        };
        a.bands[0] = band(0, Math.max(1, Math.floor(n * 0.08)));
        a.bands[1] = band(Math.floor(n * 0.08), Math.floor(n * 0.35));
        a.bands[2] = band(Math.floor(n * 0.35), n);
      };
      tick();
    } catch (err) {
      console.warn('[vara] mic metering unavailable', err);
    }
  }, []);

  const stopMeter = useCallback(() => {
    cancelAnimationFrame(meterRafRef.current);
    meterRafRef.current = 0;

    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;

    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;

    audioRef.current.user = 0;
    audioRef.current.agent = 0;
    audioRef.current.bands = [0, 0, 0];
  }, []);

  /* --------------------------------------------------------------- stop */

  const stop = useCallback(() => {
    sessionGenRef.current += 1;
    activeRef.current = false;
    try {
      vapiRef.current?.stop();
    } catch {
      /* already torn down */
    }
    stopMeter();
    setMuted(false);
  }, [stopMeter]);

  useEffect(() => () => stop(), [stop]);

  /* -------------------------------------------------- session lifecycle */

  const wire = useCallback((vapi: VapiInstance) => {
    vapi.on('call-start', () => {
      setStatus('listening');
      try {
        callIdRef.current = vapi.getCallId?.() ?? undefined;
      } catch {
        callIdRef.current = undefined;
      }

      // Let the greeting land before injecting a queued question.
      const queued = pendingRef.current;
      if (queued) {
        pendingRef.current = null;
        setTimeout(() => {
          if (!activeRef.current) return;
          try {
            vapi.send({ type: 'add-message', message: { role: 'user', content: queued } });
            pushTranscript('user', queued, true);
          } catch (err) {
            console.error('[vara] could not send queued question', err);
          }
        }, 2500);
      }
    });

    vapi.on('call-end', () => {
      activeRef.current = false;
      stopMeter();
      setMuted(false);
      setStatus((prev) => (prev === 'error' ? prev : 'ended'));
    });

    vapi.on('speech-start', () => {
      if (activeRef.current) setStatus('speaking');
    });

    vapi.on('speech-end', () => {
      if (activeRef.current) setStatus('listening');
      audioRef.current.agent = 0;
    });

    vapi.on('volume-level', (level: number) => {
      audioRef.current.agent = Number.isFinite(level)
        ? Math.max(0, Math.min(1, level))
        : 0;
    });

    vapi.on('error', (err: unknown) => {
      // Assistant hang-up, goodbye phrases, silence timeout, or the visitor
      // ending a call that Daily has already torn down. Same as call-end.
      if (isBenignHangup(err)) {
        activeRef.current = false;
        stopMeter();
        setMuted(false);
        setStatus((prev) => (prev === 'error' ? prev : 'ended'));
        return;
      }

      const detail = errorText(err);
      // Daily often emits a payload that serialises to {}. Treat that as
      // teardown noise, not a failed connection — console.error would open
      // the Next.js overlay in dev.
      if (!detail) {
        console.warn('[vara] ignored empty session error');
        return;
      }

      console.warn('[vara] session error', detail);
      // The instance is now built ahead of the click, so it can emit while
      // nobody is in a call. Don't surface an error banner on an idle page.
      if (!activeRef.current) return;
      activeRef.current = false;
      stopMeter();
      setError({ kind: 'connection', detail });
      setStatus('error');
    });

    vapi.on('message', (message: any) => {
      if (!message || typeof message !== 'object') return;

      if (message.type === 'transcript' && typeof message.transcript === 'string') {
        const role = message.role === 'assistant' ? 'assistant' : 'user';
        pushTranscript(role, message.transcript, message.transcriptType === 'final');
        return;
      }

      // Vapi often sends this before Daily's ejection error. Mark the session
      // idle first so the later error is ignored even if it is not classified.
      if (message.type === 'status-update' && message.status === 'ended') {
        activeRef.current = false;
        stopMeter();
        setMuted(false);
        setStatus((prev) => (prev === 'error' ? prev : 'ended'));
        return;
      }

      // Surface a confirmation when Sunny saves someone's details, and mirror
      // the capture to our API so localhost still stores the lead + sends email
      // even when Vapi cannot reach our webhook.
      const names: string[] = [];
      if (Array.isArray(message.toolCallList)) {
        names.push(...message.toolCallList.map((c: any) => c?.name).filter(Boolean));
      }
      if (Array.isArray(message.toolCalls)) {
        names.push(...message.toolCalls.map((c: any) => c?.function?.name).filter(Boolean));
      }
      if (message.type === 'function-call' && message.functionCall?.name) {
        names.push(message.functionCall.name);
      }
      if (names.includes('capture_lead')) {
        setLeadCaptured(true);
        const args = captureLeadArgs(message);
        if (args && (args.email || args.phone || args.name)) {
          void fetch('/api/lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source: 'voice',
              language: langRef.current,
              callId: callIdRef.current,
              tenantSlug: slugRef.current || 'vara',
              ...args,
            }),
          }).catch(() => {});
        }
      }
    });
  }, [pushTranscript, stopMeter]);

  /**
   * Build the voice session object ahead of time.
   *
   * The SDK is a lazily-imported chunk. Fetching it on click added a visible
   * pause before "connecting" even began, so it is warmed shortly after the
   * page settles instead — by the time anyone taps the orb, the module is
   * already parsed and the instance already wired.
   */
  const ensureVapi = useCallback(async (): Promise<VapiInstance | null> => {
    if (vapiRef.current) return vapiRef.current;
    if (!config?.publicKey) return null;

    const { default: Vapi } = await import('@vapi-ai/web');
    // Guard against two callers racing the same import.
    if (vapiRef.current) return vapiRef.current;

    const instance = new Vapi(config.publicKey);
    wire(instance);
    vapiRef.current = instance;
    return instance;
  }, [config, wire]);

  useEffect(() => {
    if (!config?.publicKey) return;
    const id = window.setTimeout(() => {
      void ensureVapi().catch(() => {});
    }, 250);
    return () => window.clearTimeout(id);
  }, [config, ensureVapi]);

  /* -------------------------------------------------------------- start */

  const start = useCallback(async () => {
    setError(null);
    setLeadCaptured(false);

    if (!config) return;

    const gen = ++sessionGenRef.current;

    if (!config.publicKey) {
      setError({ kind: 'not-configured' });
      setStatus('error');
      return;
    }

    // Ask for the microphone explicitly so a denial is a clear, handled state
    // rather than an opaque SDK failure.
    setStatus('requesting-mic');
    try {
      // Keep this stream rather than stopping it: it serves as both the
      // permission check and the source for level metering.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (gen !== sessionGenRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      micStreamRef.current = stream;
      startMeter(stream);
    } catch {
      setError({ kind: 'mic-denied' });
      setStatus('error');
      return;
    }

    const liveLang = langRef.current;
    const assistantId = config.assistants[liveLang];
    if (!assistantId) {
      stopMeter();
      setError({ kind: 'not-configured' });
      setStatus('error');
      return;
    }

    setStatus('connecting');
    setTurns([]);

    try {
      // Almost always already built by the prewarm effect above.
      const vapi = await ensureVapi();
      if (!vapi) throw new Error('voice session unavailable');
      if (gen !== sessionGenRef.current) return;

      // Drop a leftover Daily room so `start()` is not a no-op after hang-up
      // (`this.started` stays true until stop/cleanup).
      try {
        await vapi.stop();
      } catch {
        /* nothing to tear down */
      }

      if (gen !== sessionGenRef.current) return;

      activeRef.current = true;
      const tenant = config.tenant;
      const name = tenant?.assistantName || 'Sunny';
      const company = tenant?.companyName || 'VARA EdTech';
      const languageLock =
        liveLang === 'th'
          ? [
              'This live call is Thai-only. Speak Thai with ครับ. Never reply in English.',
              TH_PRONUNCIATION_LOCK,
            ].join('\n')
          : [
              'This live call is English-only. Do not speak Thai.',
              'Say the company as Vah-rah Ed Tech, two clear words. Never voritec.',
              'Say the founder as SUN-jay KOO-mar. Never Sanjiya.',
            ].join(' ');
      const pipeline =
        liveLang === 'th'
          ? {
              transcriber: {
                provider: 'azure',
                language: 'th-TH',
                segmentationStrategy: 'Semantic',
              },
              voice: {
                provider: 'azure',
                voiceId: 'th-TH-NiwatNeural',
                speed: 0.8,
                chunkPlan: TH_VOICE_CHUNK_PLAN,
              },
            }
          : {
              transcriber: {
                provider: 'deepgram',
                model: 'nova-3',
                language: 'en',
                smartFormat: true,
              },
              voice: {
                provider: 'vapi',
                voiceId: 'Elliot',
                version: 2,
                speed: 0.96,
              },
            };
      const overrides = {
        firstMessageMode: 'assistant-speaks-first',
        firstMessage:
          liveLang === 'th'
            ? TH_FIRST_MESSAGE
            : `Hi, this is ${name} from ${company}. How may I help you?`,
        ...pipeline,
        variableValues: {
          assistantName: liveLang === 'th' ? TH_SPOKEN_SUNNY : name,
          companyName: liveLang === 'th' ? TH_SPOKEN_COMPANY : company,
          clientSkills: tenant?.clientSkills || '',
          extraInstructions: [languageLock, tenant?.extraInstructions]
            .filter(Boolean)
            .join('\n'),
        },
        metadata: {
          language: liveLang,
          ...(tenant ? { tenantSlug: tenant.slug } : {}),
        },
      };
      const call = await startWithFallback(vapi, assistantId, overrides, liveLang);
      if (!call && activeRef.current) {
        throw new Error('voice session unavailable');
      }
    } catch (err) {
      if (isBenignHangup(err)) {
        activeRef.current = false;
        stopMeter();
        setMuted(false);
        setStatus('ended');
        return;
      }
      console.error('[vara] start failed', err);
      activeRef.current = false;
      stopMeter();
      setError({ kind: 'connection', detail: errorText(err) || undefined });
      setStatus('error');
    }

  }, [config, ensureVapi, startMeter, stopMeter]);

  /* --------------------------------------------------------------- mute */

  const toggleMute = useCallback(() => {
    const vapi = vapiRef.current;
    if (!vapi) return;
    const next = !muted;
    try {
      vapi.setMuted(next);
      setMuted(next);
      // A muted mic should not keep driving the visualisation.
      if (next) audioRef.current.user = 0;
    } catch {
      /* not in a call */
    }
  }, [muted]);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setTurns([]);
    pendingRef.current = null;
  }, []);

  /**
   * Ask a question on the visitor's behalf — used by the suggestion chips.
   * If no call is running yet, the question is queued and replayed once Vara
   * has finished greeting.
   */
  const ask = useCallback(
    (text: string) => {
      const question = text.trim();
      if (!question) return;

      if (activeRef.current && vapiRef.current) {
        try {
          vapiRef.current.send({
            type: 'add-message',
            message: { role: 'user', content: question },
          });
          pushTranscript('user', question, true);
          return;
        } catch (err) {
          console.error('[vara] could not send question', err);
        }
      }

      pendingRef.current = question;
      void start();
    },
    [pushTranscript, start]
  );

  const isActive =
    status === 'connecting' ||
    status === 'listening' ||
    status === 'speaking' ||
    status === 'requesting-mic';

  return {
    config,
    status,
    isActive,
    audio: audioRef,
    turns,
    error,
    muted,
    leadCaptured,
    start,
    stop,
    ask,
    toggleMute,
    reset,
  };
}
