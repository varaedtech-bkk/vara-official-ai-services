'use client';

import { useEffect, useMemo, useState } from 'react';
import { getCopy, type Lang } from '@/lib/i18n';
import { useVara } from '@/lib/useVara';
import FluidOrb from './FluidOrb';
import TextChat from './TextChat';

type Theme = 'dark' | 'light';

/**
 * Concrete colours per theme.
 *
 * Applied as inline styles rather than through inherited CSS custom
 * properties, so a theme change is a plain React re-render with nothing to
 * recompute.
 */
const THEMES = {
  dark: {
    bg: '#08070c',
    fg: '#f5f5f7',
    fgDim: 'rgba(245,245,247,0.45)',
    fgFaint: 'rgba(245,245,247,0.30)',
    grid: 'rgba(232,64,47,0.075)',
    surface: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.12)',
  },
  light: {
    bg: '#f4f3f6',
    fg: '#16151a',
    fgDim: 'rgba(22,21,26,0.55)',
    fgFaint: 'rgba(22,21,26,0.38)',
    grid: 'rgba(232,64,47,0.12)',
    surface: 'rgba(0,0,0,0.04)',
    border: 'rgba(0,0,0,0.14)',
  },
} as const;

/**
 * Orb radius and centre, mirrored from FluidOrb's `ORB` constants.
 *
 * Both resolve against the same box: the canvas fills a `h-[100dvh]` parent,
 * so `dvh` here and the canvas's measured pixel height are the same number.
 * Mixing `%` of the container with `dvh` is what previously let the hit target
 * and the status line drift apart.
 */
const ORB_R = 'min(25dvh, 34vw)';
const ORB_CENTER_Y = '44dvh';

/**
 * One screen. No scrolling, no forms, no suggestions.
 *
 * The orb canvas is full-bleed and pointer-transparent so the wave can run off
 * both edges of the screen; the click target is a circular button laid over it.
 *
 * English and Thai each have their own voice assistant. The EN / TH control
 * in the header starts the matching one. Switching language ends a live call.
 */
export default function AssistantExperience({ slug = 'vara' }: { slug?: string }) {
  const [lang, setLang] = useState<Lang>('en');
  const copy = getCopy(lang);
  const [theme, setTheme] = useState<Theme>('dark');

  const c = THEMES[theme];

  const vara = useVara(lang, { slug });
  const { status, isActive, audio, turns, error, muted, leadCaptured } = vara;
  const [chatOpen, setChatOpen] = useState(false);

  /* Read back whatever the inline script in <head> already applied, so the
     toggle starts in agreement with what was painted. */
  useEffect(() => {
    const current = (document.documentElement.getAttribute('data-theme') as Theme) || 'dark';
    setTheme(current);
    try {
      const stored = localStorage.getItem('vara-lang');
      if (stored === 'en' || stored === 'th') setLang(stored);
    } catch {
      /* private mode */
    }
  }, []);

  /* Paint the document surfaces directly — inline styles on <body> always win
     and do not depend on custom-property inheritance being recomputed. */
  useEffect(() => {
    const t = THEMES[theme];
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    document.documentElement.lang = copy.htmlLang;
    document.body.style.backgroundColor = t.bg;
    document.body.style.color = t.fg;
  }, [theme, copy.htmlLang]);

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('vara-theme', next);
    } catch {
      /* private mode — the choice just won't persist */
    }
  }

  function switchLang(next: Lang) {
    if (next === lang) return;
    if (vara.isActive) vara.stop();
    vara.reset();
    setLang(next);
    try {
      localStorage.setItem('vara-lang', next);
    } catch {
      /* private mode */
    }
  }

  function openChat() {
    if (vara.isActive) vara.stop();
    vara.reset();
    setChatOpen(true);
  }

  function closeChat() {
    setChatOpen(false);
  }

  const statusLabel = {
    idle: copy.statusIdle,
    'requesting-mic': copy.statusConnecting,
    connecting: copy.statusConnecting,
    listening: copy.statusListening,
    speaking: copy.statusSpeaking,
    ended: copy.statusEnded,
    error:
      error?.kind === 'mic-denied'
        ? copy.statusMicBlocked
        : error?.kind === 'not-configured'
          ? copy.notConfigured
          : copy.connectionError,
  }[status];

  /* The last thing said by each side — that's the whole caption. */
  const caption = useMemo(() => {
    const assistant = [...turns].reverse().find((t) => t.role === 'assistant');
    const user = [...turns].reverse().find((t) => t.role === 'user');
    return { assistant, user };
  }, [turns]);

  const showingCaptions = isActive && turns.length > 0;

  const notConfigured = vara.config !== null && !vara.config.configured;
  const blocked = error?.kind === 'mic-denied' || error?.kind === 'not-configured' || notConfigured;
  const website = vara.config?.tenant?.website || 'https://varaedtech.com';
  let visitHost = 'varaedtech.com';
  try {
    visitHost = new URL(website).hostname.replace(/^www\./, '');
  } catch {
    /* keep default */
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      {/* Wide grid backdrop, masked so it frames the orb rather than
          competing with its glow. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            `linear-gradient(${c.grid} 1px, transparent 1px),` +
            `linear-gradient(90deg, ${c.grid} 1px, transparent 1px)`,
          backgroundSize: '88px 88px',
          maskImage: 'radial-gradient(ellipse 78% 68% at 50% 44%, #000 30%, transparent 78%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 78% 68% at 50% 44%, #000 30%, transparent 78%)',
        }}
      />

      {/* ------------------------------------------------------------ chrome */}
      <header
        className="absolute inset-x-0 top-0 z-40 flex items-center justify-between gap-3
                    px-4 py-4 sm:px-8 sm:py-5"
      >
        <a
          href={website}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={vara.config?.tenant?.companyName || 'VARA EdTech'}
          className="flex h-9 shrink-0 items-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={vara.config?.tenant?.logoUrl || '/brand/vara-logo.png'}
            alt={vara.config?.tenant?.companyName || 'VARA EdTech'}
            className="h-7 w-auto sm:h-8"
          />
        </a>

        <nav
          className="flex h-9 shrink-0 items-center gap-1.5 sm:gap-2"
          aria-label="Site"
        >
          <a
            href={website}
            target="_blank"
            rel="noreferrer noopener"
            title={copy.footerVisit}
            className="inline-flex h-9 max-w-[min(42vw,11rem)] items-center rounded-full px-2.5
                       text-[11px] font-semibold tracking-wide sm:max-w-none sm:px-3 sm:text-[12px]"
            style={{
              color: c.fgDim,
              border: `1px solid ${c.border}`,
            }}
          >
            <span className="truncate sm:hidden">{copy.footerVisitShort}</span>
            <span className="hidden sm:inline">
              {lang === 'th' ? `เยี่ยมชม ${visitHost}` : `Visit ${visitHost}`}
            </span>
            <span className="ml-1 shrink-0 opacity-70" aria-hidden>
              ↗
            </span>
          </a>
          <div
            role="group"
            aria-label={copy.langLabel}
            className="flex h-9 overflow-hidden rounded-full text-[11px] font-semibold tracking-[0.14em]"
            style={{ border: `1px solid ${c.border}` }}
          >
            {(['en', 'th'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => switchLang(code)}
                className="h-9 px-2.5 uppercase transition-colors duration-200 sm:px-3"
                style={{
                  color: lang === code ? c.fg : c.fgDim,
                  background: lang === code ? c.surface : 'transparent',
                }}
                aria-pressed={lang === code}
                title={copy.switchNote}
              >
                {code}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="icon-btn"
            style={{ color: c.fgDim }}
            aria-label={theme === 'dark' ? 'Switch to light background' : 'Switch to dark background'}
            title={theme === 'dark' ? 'Light background' : 'Dark background'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </nav>
      </header>

      {/* ------------------------------------------------------------- stage */}
      <FluidOrb status={status} audio={audio} active={isActive} theme={theme} />

      {/*
        Hit target and status share one absolutely-positioned column, so the
        text flows after the button and can never land on top of it.
      */}
      <div
        className={`absolute inset-x-0 z-10 flex flex-col items-center px-6 pb-8 ${
          chatOpen ? 'pointer-events-none opacity-0' : ''
        }`}
        style={{ top: `calc(${ORB_CENTER_Y} - ${ORB_R})` }}
      >
        <button
          type="button"
          onClick={isActive ? vara.stop : vara.start}
          aria-label={isActive ? copy.ctaEnd : copy.ctaStart}
          className="group flex-none rounded-full outline-none transition-transform
                     duration-500 hover:scale-[1.02] active:scale-[0.99]
                     focus-visible:ring-2 focus-visible:ring-vara-red/60"
          style={{ width: `calc(${ORB_R} * 2)`, height: `calc(${ORB_R} * 2)` }}
        >
          <span
            aria-hidden
            className={`pointer-events-none flex h-full w-full items-center justify-center
                        transition-all duration-700 ${
                          isActive ? 'scale-90 opacity-0' : 'opacity-100'
                        }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-9 w-9 translate-y-[14%] opacity-45 transition-opacity duration-300
                         group-hover:opacity-90"
              style={{ color: c.fg }}
              {...strokeProps}
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <path d="M12 19v3" />
            </svg>
          </span>
        </button>

        <p
          aria-live="polite"
          className={`mt-7 text-[13px] font-medium uppercase tracking-[0.22em]
                      transition-opacity duration-500 ${
                        showingCaptions ? 'opacity-0' : 'opacity-100'
                      }`}
          style={{ color: c.fgDim }}
        >
          {statusLabel}
        </p>

        <p
          className={`mt-2 text-sm transition-all duration-500 ${
            isActive ? 'pointer-events-none translate-y-1 opacity-0' : 'opacity-100'
          }`}
          style={{ color: c.fgFaint }}
        >
          {copy.tapToSpeak}
        </p>

        {!isActive && (
          <button
            type="button"
            onClick={openChat}
            className="mt-8 w-full max-w-[22rem] rounded-2xl px-5 py-3.5 text-left
                       transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99]"
            style={{
              color: c.fg,
              background: c.surface,
              border: `1px solid ${c.border}`,
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="grid h-10 w-10 flex-none place-items-center rounded-full"
                style={{ background: 'rgba(232,64,47,0.16)', color: '#e8402f' }}
                aria-hidden
              >
                <ChatMini />
              </span>
              <span>
                <span className="block text-[15px] font-semibold tracking-tight">{copy.typeInstead}</span>
                <span className="mt-0.5 block text-[12px] leading-snug" style={{ color: c.fgDim }}>
                  {copy.typeInsteadHint}
                </span>
              </span>
            </div>
          </button>
        )}
      </div>

      {/* --------------------------------------------------------- captions */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-28 z-20 flex flex-col items-center
                    justify-end gap-1.5 overflow-hidden px-6 transition-opacity duration-700 ${
                      showingCaptions ? 'opacity-100' : 'opacity-0'
                    }`}
        style={{ maxHeight: '22dvh' }}
      >
        {caption.user && (
          <p
            className="max-w-2xl animate-fade-up text-center text-[14px] leading-snug"
            style={{ color: c.fgFaint }}
          >
            {caption.user.text}
          </p>
        )}
        {caption.assistant && (
          <p
            className="max-w-3xl animate-fade-up text-center text-[17px] leading-snug sm:text-lg"
            style={{ color: c.fg }}
          >
            {caption.assistant.text}
          </p>
        )}
      </div>

      {/* --------------------------------------------------- call controls */}
      <div
        className={`absolute inset-x-0 bottom-10 z-20 flex items-center justify-center gap-5
                    transition-all duration-500 ${
                      isActive ? 'opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
                    }`}
      >
        <button
          type="button"
          onClick={vara.toggleMute}
          className={`call-btn ${muted ? 'call-btn-active' : ''}`}
          style={
            muted
              ? undefined
              : { background: c.surface, border: `1px solid ${c.border}`, color: c.fg }
          }
          aria-label={muted ? copy.muteOff : copy.muteOn}
          title={muted ? copy.muteOff : copy.muteOn}
        >
          {muted ? <MicOffIcon /> : <MicIcon />}
        </button>

        <button
          type="button"
          onClick={vara.stop}
          className="call-btn-end"
          aria-label={copy.ctaEnd}
          title={copy.ctaEnd}
        >
          <HangUpIcon />
        </button>
      </div>

      {/* ----------------------------------------------------- lead confirm */}
      {leadCaptured && (
        <div
          role="status"
          className="absolute inset-x-0 top-20 z-30 mx-auto w-fit animate-fade-up rounded-full
                     border border-vara-red/35 bg-vara-red/10 px-5 py-2 text-sm
                     text-vara-red-bright backdrop-blur-sm"
        >
          {copy.leadCapturedToast}
        </div>
      )}

      {/* ---------------------------------------------------------- alerts */}
      {(blocked || error?.kind === 'connection') && !chatOpen && (
        <div
          role="alert"
          className="absolute inset-x-0 bottom-28 z-30 mx-auto w-fit max-w-md animate-fade-up
                     rounded-2xl px-5 py-4 text-center"
          style={{
            background: c.surface,
            border: `1px solid ${c.border}`,
            backdropFilter: 'blur(8px)',
          }}
        >
          <p className="text-sm font-medium text-vara-red-bright">
            {error?.kind === 'mic-denied'
              ? copy.micDenied
              : error?.kind === 'connection'
                ? copy.connectionError
                : copy.notConfigured}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: c.fgDim }}>
            {error?.kind === 'mic-denied'
              ? copy.micDeniedHelp
              : error?.kind === 'connection'
                ? copy.connectionErrorHelp
                : copy.notConfiguredHelp}
          </p>
          {error?.kind === 'connection' && error.detail ? (
            <p className="mt-2 break-words text-[11px] leading-relaxed" style={{ color: c.fgFaint }}>
              {error.detail}
            </p>
          ) : null}
        </div>
      )}

      {chatOpen && (
        <TextChat
          key={lang}
          lang={lang}
          copy={copy}
          colors={{ fg: c.fg, fgDim: c.fgDim, fgFaint: c.fgFaint, surface: c.surface, border: c.border }}
          onClose={closeChat}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ icons */

const strokeProps = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...strokeProps}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...strokeProps}>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <path d="M15 10.5V5a3 3 0 0 0-5.94-.6" />
      <path d="M19 10v2a7 7 0 0 1-10.9 5.8" />
      <path d="M5 10v2a7 7 0 0 0 2 4.9" />
      <path d="M12 19v3" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

/** Classic hang-up: the handset rotated, the way every phone UI signals "end". */
function HangUpIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <g transform="rotate(135 12 12)">
        <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.7.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.7 21 3 13.3 3 3.9c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.7.1.3 0 .7-.2 1l-2.2 2.2Z" />
      </g>
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" {...strokeProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" {...strokeProps}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

function ChatMini() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...strokeProps}>
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 1 1 18 0Z" />
    </svg>
  );
}
