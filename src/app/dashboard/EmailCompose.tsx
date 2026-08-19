'use client';

import { useMemo, useState } from 'react';
import type { Skill } from '@/lib/saas/types';
import { buildEmailBody, inferClientAsk, pickSkillsForAsk } from '@/lib/email-template';
import { BrandMark } from './BrandMark';
import { previewFollowUpEmail, sendFollowUpEmailNow } from './email-actions';

export function EmailCompose({
  defaultTo,
  alternatives = [],
  name,
  callId,
  leadId,
  interest,
  topic,
  adminNotes,
  skills = [],
  alreadySent,
  companyName,
  assistantName,
  website,
  logoUrl,
  onSent,
}: {
  defaultTo: string;
  alternatives?: string[];
  name?: string;
  callId?: string;
  leadId?: string;
  interest?: string;
  topic?: string;
  adminNotes?: string;
  skills?: Skill[];
  alreadySent?: boolean;
  companyName?: string;
  assistantName?: string;
  website?: string;
  logoUrl?: string;
  onSent?: () => void;
}) {
  const starter = useMemo(() => {
    const ask = inferClientAsk(adminNotes, interest, topic);
    return buildEmailBody(
      {
        id: leadId || 'preview',
        createdAt: new Date().toISOString(),
        source: 'voice',
        language: 'en',
        email: defaultTo,
        name,
        callId,
        interest,
        topic,
        summary: adminNotes,
      },
      { companyName, assistantName, website },
      { ask, passages: pickSkillsForAsk(skills, ask) },
    );
  }, [adminNotes, assistantName, callId, companyName, defaultTo, interest, leadId, name, skills, topic, website]);

  const [to, setTo] = useState(defaultTo);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(starter.subject);
  const [text, setText] = useState(starter.text);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(!!alreadySent);
  const [error, setError] = useState('');

  const others = alternatives.filter((a) => a.toLowerCase() !== to.trim().toLowerCase());
  const fromLabel = companyName || 'Workspace';
  const site = website?.replace(/^https?:\/\//, '');

  const payload = {
    leadId,
    email: to.trim(),
    name,
    callId,
    interest,
    topic,
    summary: adminNotes,
    subject: subject.trim(),
    text: text.trim(),
  };

  async function loadPreview(e?: React.MouseEvent) {
    e?.stopPropagation();
    setError('');
    setOpen(true);
    setSubject(starter.subject);
    setText(starter.text);
    setLoading(true);
    try {
      const data = await previewFollowUpEmail({
        leadId,
        email: to.trim(),
        name,
        callId,
        interest,
        topic,
        summary: adminNotes,
      });
      if (!data.ok) {
        setError(data.error ?? 'Showing a local draft — add details, then send.');
        return;
      }
      if (data.subject) setSubject(data.subject);
      if (data.text) setText(data.text);
    } catch {
      setError('Showing a local draft — add details, then send.');
    } finally {
      setLoading(false);
    }
  }

  async function send(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open) {
      await loadPreview();
      return;
    }
    setSending(true);
    setError('');
    try {
      const data = await sendFollowUpEmailNow(payload);
      if (!data.ok) {
        setError(data.error ?? 'Send failed');
        return;
      }
      setSent(true);
      onSent?.();
    } catch {
      setError('Network error');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return <span className="dash-banner dash-banner-ok" style={{ display: 'inline-block', margin: 0 }}>Sent to client</span>;
  }

  const actions = (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      <button type="button" onClick={loadPreview} disabled={loading} className="dash-btn dash-btn-ghost">
        {open ? (loading ? 'Loading…' : 'Regenerate') : 'Write reply'}
      </button>
      <button type="button" onClick={send} disabled={sending || loading} className="dash-btn dash-btn-primary">
        {sending ? 'Sending…' : open ? 'Send to client' : 'Review & send'}
      </button>
    </div>
  );

  return (
    <div onClick={(e) => e.stopPropagation()} style={open ? undefined : { padding: '8px 18px 16px' }}>
      {!open && actions}
      {open && (
        <div className="composer">
          <aside className="composer-notes">
            <h3>Internal only</h3>
            <p>{adminNotes || 'No call notes. Use the letter on the right for what the client asked for.'}</p>
            <p className="dash-hint" style={{ marginTop: 12 }}>
              This column is never emailed. Add pricing, a demo slot, or extra detail in the letter.
            </p>
          </aside>
          <div className="composer-letter">
            <div className="letter">
              <div className="letter-head">
                <BrandMark logoUrl={logoUrl} companyName={companyName} size={36} />
                <div>
                  <strong>{fromLabel}</strong>
                  <span>
                    From {assistantName || 'Sara'}
                    {site ? ` · ${site}` : ''}
                  </span>
                </div>
              </div>
              <div className="letter-fields">
                <label className="dash-label">
                  To
                  <input className="dash-input" type="email" value={to} onChange={(e) => setTo(e.target.value)} />
                </label>
                {others.length > 0 && (
                  <div>
                    <div className="dash-hint" style={{ marginTop: 0 }}>Heard on the call — click to use</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {others.map((alt) => (
                        <button key={alt} type="button" className="alt-chip" onClick={() => setTo(alt)}>
                          {alt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <label className="dash-label">
                  Subject
                  <input className="dash-input" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </label>
              </div>
              <div className="letter-body">
                <label className="dash-label">Letter</label>
                <textarea className="dash-textarea" value={text} onChange={(e) => setText(e.target.value)} rows={14} />
              </div>
            </div>
            {error && <div className="dash-banner dash-banner-err" style={{ marginTop: 10, marginBottom: 0 }}>{error}</div>}
            <div className="composer-foot">
              <span className="dash-hint" style={{ margin: 0 }}>Sends from this workspace SMTP as {fromLabel}.</span>
              {actions}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
