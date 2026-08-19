'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Copy, Lang } from '@/lib/i18n';

type Msg = { role: 'user' | 'assistant'; content: string };

type Colors = {
  fg: string;
  fgDim: string;
  fgFaint: string;
  surface: string;
  border: string;
};

export default function TextChat({
  lang,
  copy,
  colors,
  onClose,
}: {
  lang: Lang;
  copy: Copy;
  colors: Colors;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: copy.chatIntro },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const history = [...messages, { role: 'user' as const, content: text }];
    setMessages(history);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, messages: history }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string };
      const reply =
        typeof data.reply === 'string' && data.reply.trim()
          ? data.reply.trim()
          : copy.leadError;
      setMessages([...history, { role: 'assistant', content: reply }]);
    } catch {
      setMessages([...history, { role: 'assistant', content: copy.leadError }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col px-3 pb-3 pt-[4.75rem] sm:px-6 sm:pt-[5.25rem]">
      <div
        className="mx-auto flex h-full w-full max-w-xl flex-col overflow-hidden rounded-[28px] shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          backdropFilter: 'blur(22px)',
        }}
      >
        <div
          className="flex items-center gap-3 px-4 py-3.5"
          style={{ borderBottom: `1px solid ${colors.border}` }}
        >
          <div
            className="grid h-10 w-10 flex-none place-items-center rounded-full text-[13px] font-bold text-white"
            style={{ background: 'linear-gradient(160deg, #ff5a4a 0%, #e23b2c 75%)' }}
            aria-hidden
          >
            S
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold tracking-tight" style={{ color: colors.fg }}>
              {copy.assistant}
            </div>
            <div className="truncate text-[12px]" style={{ color: colors.fgDim }}>
              {copy.backToVoiceHint}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex flex-none items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold"
            style={{
              color: colors.fg,
              background: 'rgba(232,64,47,0.12)',
              border: '1px solid rgba(232,64,47,0.35)',
            }}
          >
            <MicMini />
            {copy.backToVoice}
          </button>
        </div>

        <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 pb-6">
          {messages.map((msg, i) => (
            <div key={`${msg.role}-${i}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <span className="px-1 text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: colors.fgFaint }}>
                  {msg.role === 'user' ? copy.you : copy.assistant}
                </span>
                <div
                  className="px-4 py-2.5 text-[15px] leading-relaxed"
                  style={{
                    color: colors.fg,
                    whiteSpace: 'pre-wrap',
                    background:
                      msg.role === 'user' ? 'rgba(232,64,47,0.18)' : 'rgba(127,127,127,0.14)',
                    borderRadius:
                      msg.role === 'user' ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 px-1 text-[13px]" style={{ color: colors.fgDim }}>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {copy.chatTyping}
            </div>
          )}
        </div>

        <form
          onSubmit={send}
          className="flex items-center gap-2 p-3"
          style={{ borderTop: `1px solid ${colors.border}` }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={copy.typePlaceholder}
            disabled={sending}
            lang={copy.htmlLang}
            className="min-w-0 flex-1 rounded-full px-4 py-3 text-[15px] outline-none"
            style={{
              background: 'rgba(127,127,127,0.1)',
              color: colors.fg,
              border: `1px solid ${colors.border}`,
            }}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label={copy.send}
            className="grid h-12 w-12 flex-none place-items-center rounded-full text-white disabled:opacity-35"
            style={{ background: '#e8402f' }}
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
}

function MicMini() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M3.4 20.6 21 12 3.4 3.4 3 10.2 15 12 3 13.8z" />
    </svg>
  );
}
