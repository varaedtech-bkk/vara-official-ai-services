'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Lead } from '@/lib/leads';
import type { VapiCall } from '@/app/api/vapi/calls/route';
import type { EmailLogEntry } from '@/lib/email';
import { emailsFromSources } from '@/lib/contact';
import SuperAdminPanel from './SuperAdminPanel';
import SettingsPanel, { type TenantConfigView } from './SettingsPanel';
import { EmailCompose } from './EmailCompose';
import { BrandMark, initials } from './BrandMark';

/* ------------------------------------------------------------------ types */

type SortKey = 'createdAt' | 'name' | 'requestType';
type LeadFilter = 'all' | 'email' | 'phone' | 'whatsapp' | 'proposal' | 'quote' | 'callback' | 'meeting';
type CallFilter = 'all' | 'completed' | 'follow-up' | 'contact' | 'error';
type Tab = 'calls' | 'leads' | 'emails' | 'settings' | 'tenants';

/* ---------------------------------------------------------------- helpers */

function fmt(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function durStr(startedAt?: string, endedAt?: string) {
  if (!startedAt || !endedAt) return '—';
  const s = Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11,
      fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' as const,
      color, background: bg, marginRight: 4, marginBottom: 2,
    }}>{label}</span>
  );
}

function greenChip(l: string) { return <Chip label={l} color="#166534" bg="#dcfce7" />; }
function redChip(l: string)   { return <Chip label={l} color="#991b1b" bg="#fee2e2" />; }
function yellowChip(l: string){ return <Chip label={l} color="#854d0e" bg="#fef9c3" />; }
function blueChip(l: string)  { return <Chip label={l} color="#1e40af" bg="#dbeafe" />; }
function grayChip(l: string)  { return <Chip label={l} color="#374151" bg="#f3f4f6" />; }

const REQ_CHIP: Record<string, JSX.Element> = {
  proposal: redChip('proposal'), quote: <Chip label="quote" color="#92400e" bg="#fde68a" />,
  callback: blueChip('callback'), meeting: <Chip label="meeting" color="#5b21b6" bg="#ede9fe" />,
  information: greenChip('info'), other: grayChip('other'),
};
const CHAN_CHIP: Record<string, JSX.Element> = {
  email: blueChip('email'), phone: greenChip('phone'),
  whatsapp: <Chip label="whatsapp" color="#065f46" bg="#d1fae5" />,
  line: greenChip('line'), any: grayChip('any'),
};

function endedChip(reason?: string) {
  if (!reason) return grayChip('ended');
  if (reason.includes('customer-ended') || reason.includes('assistant-ended')) return greenChip('completed');
  if (reason.includes('silence')) return yellowChip('silence');
  if (reason.includes('max-duration')) return yellowChip('time limit');
  if (reason.includes('microphone')) return grayChip('no mic');
  if (reason.includes('error')) return redChip('error');
  return grayChip(reason.replace(/-/g, ' ').slice(0, 22));
}

/* ---------------------------------------------------------------- stat card */

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`dash-stat${accent ? ' accent' : ''}`}>
      <b>{value}</b>
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </div>
  );
}

/* --------------------------------------------------------------- call row */

function CallRow({ call }: { call: VapiCall }) {
  const [open, setOpen] = useState(false);
  const sd = (call.analysis?.structuredData ?? {}) as Record<string, unknown>;
  const hasContent = !!(call.transcript || call.summary || call.analysis?.summary);
  const cb = call.costBreakdown as Record<string, number> | undefined;

  const emails: string[] = [];
  if (call.transcript) {
    const found = call.transcript.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
    if (found) emails.push(...[...new Set(found)]);
  }

  return (
    <div className="dash-card" style={{ overflow: 'hidden' }}>
      {/* summary row */}
      <div
        style={{ display: 'flex', gap: 12, padding: '13px 16px', cursor: hasContent ? 'pointer' : 'default', alignItems: 'flex-start' }}
        onClick={() => hasContent && setOpen(v => !v)}
      >
        {/* col 1: time / duration / cost */}
        <div style={{ flex: '0 0 130px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{fmt(call.startedAt)}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{durStr(call.startedAt, call.endedAt)}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{call.cost != null ? `$${call.cost.toFixed(4)}` : ''}</div>
        </div>

        {/* col 2: badges + summary + visitor */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, marginBottom: 5 }}>
            {endedChip(call.endedReason)}
            {sd.wantsFollowUp === true && redChip('follow-up')}
            {sd.contactProvided === true && greenChip('contact given')}
            {call.analysis?.successEvaluation === 'true' && greenChip('success')}
            {call.analysis?.successEvaluation === 'false' && yellowChip('not success')}
          </div>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
            {call.summary || call.analysis?.summary || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No summary</span>}
          </div>
          {sd.visitorName && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              <strong>{String(sd.visitorName)}</strong>
              {sd.organization ? ` · ${String(sd.organization)}` : ''}
              {sd.audience ? ` · ${String(sd.audience)}` : ''}
            </div>
          )}
          {Array.isArray(sd.servicesDiscussed) && sd.servicesDiscussed.length > 0 && (
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              Topics: {(sd.servicesDiscussed as string[]).join(', ')}
            </div>
          )}
          {emails.length > 0 && (
            <div style={{ fontSize: 11, color: '#2563eb', marginTop: 2 }}>
              Email(s) in transcript: {emails.join(', ')}
            </div>
          )}
        </div>

        {/* col 3: links */}
        <div style={{ flex: '0 0 110px', textAlign: 'right' }}>
          {call.recordingUrl && (
            <a href={call.recordingUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
              style={{ display: 'block', fontSize: 12, color: '#2563eb', textDecoration: 'none', marginBottom: 4 }}>
              Recording ↗
            </a>
          )}
          {cb && (
            <div style={{ fontSize: 10, color: '#9ca3af', lineHeight: 1.6, marginTop: 4 }}>
              {cb.stt != null ? `STT $${cb.stt.toFixed(4)}` : ''}<br />
              {cb.llm != null ? `LLM $${cb.llm.toFixed(4)}` : ''}<br />
              {cb.tts != null ? `TTS $${cb.tts.toFixed(4)}` : ''}
            </div>
          )}
          <div style={{ fontSize: 10, color: '#d1d5db', marginTop: 4 }}>{call.id.slice(0, 8)}…</div>
          {hasContent && (
            <div style={{ fontSize: 11, color: '#2563eb', marginTop: 6 }}>{open ? '▲ hide' : '▼ transcript'}</div>
          )}
        </div>
      </div>

      {/* transcript / eval */}
      {open && (
        <div style={{ borderTop: '1px solid #f3f4f6', background: '#f9fafb', padding: '14px 16px' }}>
          {call.analysis?.successEvaluation && (
            <div style={{ marginBottom: 10 }}>
              <Label>Success evaluation</Label>
              <div style={{ fontSize: 13, color: '#374151' }}>{call.analysis.successEvaluation}</div>
            </div>
          )}
          {call.transcript && (
            <>
              <Label>Full transcript</Label>
              <TranscriptBlock text={call.transcript} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- lead row */

function LeadRow({
  lead,
  onSendEmail,
  companyName,
  assistantName,
  website,
  skills,
  logoUrl,
}: {
  lead: Lead;
  onSendEmail: (id: string) => void;
  companyName?: string;
  assistantName?: string;
  website?: string;
  skills?: { id: string; title: string; body: string }[];
  logoUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const hasContent = !!(lead.transcript || lead.summary);

  return (
    <div className="dash-card" style={{ overflow: 'hidden' }}>
      <div
        style={{ display: 'flex', gap: 12, padding: '13px 16px', cursor: hasContent ? 'pointer' : 'default', alignItems: 'flex-start' }}
        onClick={() => hasContent && setOpen(v => !v)}
      >
        {/* name / org */}
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lead.name ?? '(unknown)'}
          </div>
          {lead.organization && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{lead.organization}</div>}
          {lead.role && <div style={{ fontSize: 11, color: '#9ca3af' }}>{lead.role}</div>}
        </div>

        {/* badges + interest */}
        <div style={{ flex: '2 1 200px', minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, marginBottom: 4 }}>
            {lead.requestType && (REQ_CHIP[lead.requestType] ?? grayChip(lead.requestType))}
            {lead.preferredContact && (CHAN_CHIP[lead.preferredContact] ?? grayChip(lead.preferredContact))}
          </div>
          {lead.interest && <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.4 }}>{lead.interest}</div>}
          {lead.topic && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, fontStyle: 'italic' }}>{lead.topic}</div>}
        </div>

        {/* contact + actions */}
        <div style={{ flex: '0 0 190px', textAlign: 'right' }}>
          {lead.email && (
            <a href={`mailto:${lead.email}`} onClick={e => e.stopPropagation()}
              style={{ display: 'block', fontSize: 12, color: '#2563eb', textDecoration: 'none' }}>
              {lead.email}
            </a>
          )}
          {lead.phone && <div style={{ fontSize: 12, color: '#374151' }}>{lead.phone}</div>}
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{fmt(lead.createdAt)}</div>
          <div style={{ fontSize: 10, color: '#d1d5db', marginTop: 1 }}>{lead.source} · {lead.language}</div>
          {hasContent && (
            <div style={{ fontSize: 11, color: '#2563eb', marginTop: 6 }}>{open ? '▲ hide' : '▼ details'}</div>
          )}
        </div>
      </div>
      {lead.email && (
        <div style={{ padding: '0 4px 12px', borderTop: '1px solid var(--dash-line)' }} onClick={e => e.stopPropagation()}>
          <EmailCompose
            defaultTo={lead.email}
            name={lead.name}
            leadId={lead.id}
            interest={lead.interest}
            topic={lead.topic}
            adminNotes={lead.summary}
            skills={skills}
            companyName={companyName}
            assistantName={assistantName}
            website={website}
            logoUrl={logoUrl}
            alreadySent={sent}
            onSent={() => { setSent(true); onSendEmail(lead.id); }}
          />
        </div>
      )}

      {open && (
        <div style={{ borderTop: '1px solid #f3f4f6', background: '#f9fafb', padding: '14px 16px' }}>
          {lead.notes && <><Label>Notes</Label><p style={{ fontSize: 13, color: '#374151', margin: '0 0 12px' }}>{lead.notes}</p></>}
          {lead.summary && <><Label>Summary</Label><p style={{ fontSize: 13, color: '#374151', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '10px 12px', margin: '0 0 12px' }}>{lead.summary}</p></>}
          {lead.transcript && <><Label>Transcript</Label><TranscriptBlock text={lead.transcript} /></>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ email log row */

function ConversationEmailRow({
  email,
  alternatives,
  visitorName,
  summary,
  startedAt,
  callId,
  sent,
  onSent,
  companyName,
  assistantName,
  website,
  skills,
  logoUrl,
}: {
  email: string;
  alternatives: string[];
  visitorName?: string;
  summary?: string;
  startedAt?: string;
  callId?: string;
  sent: boolean;
  onSent: () => void;
  companyName?: string;
  assistantName?: string;
  website?: string;
  skills?: { id: string; title: string; body: string }[];
  logoUrl?: string;
}) {
  return (
    <div className="queue-card">
      <div className="queue-card-top">
        <div className="dash-avatar">{initials(visitorName || email)}</div>
        <div className="queue-card-meta">
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 650, letterSpacing: '-0.02em' }}>{visitorName || 'Visitor'}</div>
              <div style={{ fontSize: 12, color: '#5c6570', marginTop: 2 }}>{email}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: '#8b939c' }}>{fmt(startedAt)}</div>
              <div style={{ marginTop: 6 }}>{sent ? greenChip('sent') : yellowChip('needs reply')}</div>
            </div>
          </div>
          {summary && (
            <p style={{ margin: '10px 0 0', fontSize: 13, color: '#5c6570', lineHeight: 1.5 }}>
              {summary}
            </p>
          )}
        </div>
      </div>
      <EmailCompose
        defaultTo={email}
        alternatives={alternatives}
        name={visitorName}
        callId={callId}
        adminNotes={summary}
        skills={skills}
        companyName={companyName}
        assistantName={assistantName}
        website={website}
        logoUrl={logoUrl}
        alreadySent={sent}
        onSent={onSent}
      />
    </div>
  );
}

function EmailRow({ entry }: { entry: EmailLogEntry }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 8, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ flex: '0 0 130px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{fmt(entry.sentAt)}</div>
        <div style={{ marginTop: 4 }}>
          {entry.status === 'sent' && greenChip('sent')}
          {entry.status === 'failed' && redChip('failed')}
          {entry.status === 'skipped' && grayChip('skipped')}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>
          <a href={`mailto:${entry.to}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{entry.to}</a>
          {entry.leadName ? ` — ${entry.leadName}` : ''}
          {entry.leadOrg ? ` · ${entry.leadOrg}` : ''}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{entry.subject}</div>
        {entry.error && (
          <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '4px 8px' }}>
            Error: {entry.error}
          </div>
        )}
        {entry.messageId && (
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>Message-ID: {entry.messageId}</div>
        )}
      </div>
      <div style={{ flex: '0 0 80px', textAlign: 'right' }}>
        {entry.requestType && (REQ_CHIP[entry.requestType] ?? grayChip(entry.requestType))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- util */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>
      {children}
    </div>
  );
}

function TranscriptBlock({ text }: { text: string }) {
  const lines = text.split('\n').filter(l => l.trim());
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 440, overflowY: 'auto' }}>
      {lines.map((line, i) => {
        const isAI = line.startsWith('AI:') || line.startsWith('Assistant:');
        const isUser = line.startsWith('User:');
        return (
          <div key={i} style={{
            padding: '7px 14px',
            background: isAI ? '#f0f9ff' : isUser ? '#fff' : '#fafafa',
            borderBottom: i < lines.length - 1 ? '1px solid #f3f4f6' : 'none',
            fontSize: 13, color: '#374151', lineHeight: 1.5,
          }}>
            {isAI && <span style={{ fontWeight: 600, color: '#0369a1', marginRight: 6 }}>Sara</span>}
            {isUser && <span style={{ fontWeight: 600, color: '#7c3aed', marginRight: 6 }}>Visitor</span>}
            {isAI ? line.replace(/^AI:\s*|^Assistant:\s*/, '') : isUser ? line.replace(/^User:\s*/, '') : line}
          </div>
        );
      })}
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`dash-pill${active ? ' is-on' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

const TITLES: Record<Tab, { title: string; sub: string }> = {
  calls: { title: 'Call logs', sub: 'Every Vapi conversation, with transcript and cost.' },
  leads: { title: 'Leads', sub: 'People who asked to be contacted.' },
  emails: { title: 'Follow-up', sub: 'Review the call, write the client letter, send from this workspace.' },
  settings: { title: 'Workspace', sub: 'Assistant name, logo, skills and SMTP.' },
  tenants: { title: 'Clients', sub: 'Manual subscriptions and paid admin logins.' },
};

/* ============================================================ main */

export default function DashboardClient({
  leads,
  vapiCalls,
  emailLog,
  role = 'super',
  tenant = null,
  tenants = [],
  admins = [],
}: {
  leads: Lead[];
  vapiCalls: VapiCall[];
  emailLog: EmailLogEntry[];
  role?: 'super' | 'admin';
  tenant?: TenantConfigView | null;
  tenants?: TenantConfigView[];
  admins?: { id: string; email: string; name: string; tenantId: string; active: boolean; createdAt: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(role === 'admin' ? 'settings' : 'calls');
  const [search, setSearch] = useState('');
  const [leadFilter, setLeadFilter] = useState<LeadFilter>('all');
  const [callFilter, setCallFilter] = useState<CallFilter>('all');
  const [sort, setSort] = useState<SortKey>('createdAt');
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  /* ---- stats ---- */
  const recent7 = Date.now() - 7 * 86400000;
  const recentCalls  = vapiCalls.filter(c => Date.parse(c.startedAt ?? c.createdAt) > recent7).length;
  const completedCalls = vapiCalls.filter(c => c.endedReason?.includes('customer-ended') || c.endedReason?.includes('assistant-ended')).length;
  const totalCost    = vapiCalls.reduce((s, c) => s + (c.cost ?? 0), 0);
  const wantsFollowUp= vapiCalls.filter(c => (c.analysis?.structuredData as Record<string, unknown>)?.wantsFollowUp === true).length;
  const emailsSent   = emailLog.filter(e => e.status === 'sent').length;
  const emailsFailed = emailLog.filter(e => e.status === 'failed').length;

  /* ---- filtered calls ---- */
  const visibleCalls = useMemo(() => {
    let r = [...vapiCalls];
    if (callFilter === 'completed') r = r.filter(c => c.endedReason?.includes('ended'));
    if (callFilter === 'follow-up') r = r.filter(c => (c.analysis?.structuredData as Record<string, unknown>)?.wantsFollowUp === true);
    if (callFilter === 'contact')   r = r.filter(c => (c.analysis?.structuredData as Record<string, unknown>)?.contactProvided === true);
    if (callFilter === 'error')     r = r.filter(c => c.endedReason?.includes('error') || c.endedReason?.includes('Error'));
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(c =>
        c.transcript?.toLowerCase().includes(q) ||
        (c.summary ?? c.analysis?.summary ?? '').toLowerCase().includes(q) ||
        String((c.analysis?.structuredData as Record<string, unknown>)?.visitorName ?? '').toLowerCase().includes(q) ||
        String((c.analysis?.structuredData as Record<string, unknown>)?.organization ?? '').toLowerCase().includes(q)
      );
    }
    return r;
  }, [vapiCalls, callFilter, search]);

  /* ---- filtered leads ---- */
  const visibleLeads = useMemo(() => {
    let r = [...leads];
    if (leadFilter !== 'all') {
      r = r.filter(l => {
        if (leadFilter === 'email')    return l.preferredContact === 'email' || !!l.email;
        if (leadFilter === 'phone')    return l.preferredContact === 'phone';
        if (leadFilter === 'whatsapp') return l.preferredContact === 'whatsapp';
        return l.requestType === leadFilter;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(l =>
        (l.name ?? '').toLowerCase().includes(q) || (l.organization ?? '').toLowerCase().includes(q) ||
        (l.email ?? '').toLowerCase().includes(q) || (l.phone ?? '').includes(q) ||
        (l.interest ?? '').toLowerCase().includes(q) || (l.summary ?? '').toLowerCase().includes(q)
      );
    }
    r.sort((a, b) => {
      if (sort === 'name') return (a.name ?? '').localeCompare(b.name ?? '');
      if (sort === 'requestType') return (a.requestType ?? '').localeCompare(b.requestType ?? '');
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
    return r;
  }, [leads, leadFilter, search, sort]);

  /* ---- filtered emails ---- */
  const visibleEmails = useMemo(() => {
    if (!search.trim()) return emailLog;
    const q = search.toLowerCase();
    return emailLog.filter(e =>
      e.to.toLowerCase().includes(q) || (e.leadName ?? '').toLowerCase().includes(q) ||
      e.subject.toLowerCase().includes(q)
    );
  }, [emailLog, search]);

  const conversationEmails = useMemo(() => {
    const sentSet = new Set(emailLog.filter(e => e.status === 'sent').map(e => e.to.toLowerCase()));
    const rows: {
      email: string;
      alternatives: string[];
      visitorName?: string;
      summary?: string;
      startedAt?: string;
      callId: string;
      sent: boolean;
    }[] = [];
    const seenCalls = new Set<string>();
    for (const call of vapiCalls) {
      if (seenCalls.has(call.id)) continue;
      seenCalls.add(call.id);
      const sd = (call.analysis?.structuredData ?? {}) as Record<string, unknown>;
      const summary = call.summary || call.analysis?.summary;
      const { preferred, all } = emailsFromSources([
        { text: summary, weight: 3 },
        { text: typeof sd.email === 'string' ? sd.email : '', weight: 2 },
        { text: call.transcript, weight: 1 },
      ]);
      if (!preferred) continue;
      rows.push({
        email: preferred,
        alternatives: all,
        visitorName: typeof sd.visitorName === 'string' ? sd.visitorName : undefined,
        summary,
        startedAt: call.startedAt ?? call.createdAt,
        callId: call.id,
        sent: all.some((e) => sentSet.has(e)),
      });
    }
    return rows;
  }, [vapiCalls, emailLog]);

  async function handleLogout() {
    await fetch('/api/dashboard/auth', { method: 'DELETE', credentials: 'include' });
    router.push('/dashboard/login');
  }

  const showOps = tab === 'calls' || tab === 'leads' || tab === 'emails';
  const pendingReview = conversationEmails.filter((r) => !r.sent).length;
  const nav = (t: Tab, label: string, count?: number, hot?: boolean) => (
    <button type="button" className={`dash-nav-btn${tab === t ? ' is-active' : ''}`} onClick={() => setTab(t)}>
      {label}
      {count != null && <span className={`dash-nav-count${hot ? ' is-hot' : ''}`}>{count}</span>}
    </button>
  );

  return (
    <div className="dash">
      <aside className="dash-nav">
        <div className="dash-brand">
          <BrandMark logoUrl={tenant?.logoUrl} companyName={tenant?.companyName} size={36} />
          <div>
            <div className="dash-brand-kicker">Workspace</div>
            <div className="dash-brand-name">{tenant?.companyName || 'VARA EdTech'}</div>
            <div className="dash-brand-sub">{role === 'super' ? 'Owner console' : tenant?.assistantName || 'Admin'}</div>
          </div>
        </div>
        <div className="dash-nav-group">Inbox</div>
        {nav('calls', 'Calls', vapiCalls.length)}
        {nav('leads', 'Leads', leads.length)}
        {nav('emails', 'Follow-up', pendingReview, pendingReview > 0)}
        <div className="dash-nav-group">Setup</div>
        {nav('settings', 'Workspace')}
        {role === 'super' && nav('tenants', 'Clients', tenants.length)}
        <div className="dash-nav-foot">
          <a className="dash-nav-link" href="/api/leads?format=csv">Export leads CSV</a>
          <button type="button" className="dash-nav-out" onClick={handleLogout}>Sign out</button>
        </div>
      </aside>

      <main className="dash-main">
        <div className="dash-head">
          <div>
            <h1>{TITLES[tab].title}</h1>
            <p>{TITLES[tab].sub}</p>
          </div>
          {tenant && (
            <div className="dash-workspace">
              <BrandMark logoUrl={tenant.logoUrl} companyName={tenant.companyName} size={22} />
              Sending as {tenant.companyName}
              {tenant.assistantName ? ` · ${tenant.assistantName}` : ''}
            </div>
          )}
        </div>

        {tab !== 'emails' && showOps && (
          <div className="dash-stats">
            <StatCard label="Total calls" value={vapiCalls.length} sub="all time" />
            <StatCard label="This week" value={recentCalls} />
            <StatCard label="Completed" value={completedCalls} />
            <StatCard label="Wants follow-up" value={wantsFollowUp} accent />
            <StatCard label="Vapi cost" value={`$${totalCost.toFixed(2)}`} />
            <StatCard label="Leads" value={leads.length} />
            <StatCard label="Emails sent" value={emailsSent} />
            {emailsFailed > 0 && <StatCard label="Emails failed" value={emailsFailed} accent />}
          </div>
        )}

        {tab === 'emails' && (
          <div className="dash-stats">
            <StatCard label="Waiting on you" value={pendingReview} accent />
            <StatCard label="In queue" value={conversationEmails.length} />
            <StatCard label="Sent" value={emailsSent} />
            {emailsFailed > 0 && <StatCard label="Failed" value={emailsFailed} accent />}
          </div>
        )}

        {showOps && (
          <div className="dash-toolbar">
            <input
              className="dash-search"
              type="search"
              placeholder={
                tab === 'calls' ? 'Search transcript, visitor, topic…'
                : tab === 'leads' ? 'Search name, email, interest…'
                : 'Search email, name, subject…'
              }
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {tab === 'leads' && (
              <select className="dash-select" value={sort} onChange={e => setSort(e.target.value as SortKey)}>
                <option value="createdAt">Newest first</option>
                <option value="name">Name A–Z</option>
                <option value="requestType">Request type</option>
              </select>
            )}
          </div>
        )}

        {tab === 'calls' && (
          <div className="dash-pills">
            {(['all', 'completed', 'follow-up', 'contact', 'error'] as CallFilter[]).map(f => (
              <FilterPill key={f} active={callFilter === f} onClick={() => setCallFilter(f)}>
                {f === 'all' ? 'All' : f === 'follow-up' ? 'Wants follow-up' : f === 'contact' ? 'Gave contact' : f.charAt(0).toUpperCase() + f.slice(1)}
              </FilterPill>
            ))}
          </div>
        )}

        {tab === 'leads' && (
          <div className="dash-pills">
            {(['all', 'proposal', 'quote', 'callback', 'meeting', 'email', 'phone', 'whatsapp'] as LeadFilter[]).map(f => (
              <FilterPill key={f} active={leadFilter === f} onClick={() => setLeadFilter(f)}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </FilterPill>
            ))}
          </div>
        )}

        {tab === 'calls' && (
          visibleCalls.length === 0
            ? <div className="dash-empty">No calls match your filter.</div>
            : visibleCalls.map(c => <CallRow key={c.id} call={c} />)
        )}

        {tab === 'leads' && (
          visibleLeads.length === 0
            ? <div className="dash-empty">No leads match your filter.</div>
            : visibleLeads.map(l => (
                <LeadRow
                  key={l.id}
                  lead={l}
                  companyName={tenant?.companyName}
                  assistantName={tenant?.assistantName}
                  website={tenant?.website}
                  skills={tenant?.skills}
                  logoUrl={tenant?.logoUrl}
                  onSendEmail={id => setSentIds(s => new Set([...s, id]))}
                />
              ))
        )}

        {tab === 'emails' && (
          <>
            <div className="dash-section">
              Waiting on you
              <span>{pendingReview}</span>
            </div>
            {conversationEmails.length === 0
              ? <div className="dash-empty">No visitor emails found in call transcripts yet.</div>
              : conversationEmails.map((row) => (
                  <ConversationEmailRow
                    key={row.callId}
                    {...row}
                    companyName={tenant?.companyName}
                    assistantName={tenant?.assistantName}
                    website={tenant?.website}
                    skills={tenant?.skills}
                    logoUrl={tenant?.logoUrl}
                    onSent={() => router.refresh()}
                  />
                ))}
            <div className="dash-section" style={{ marginTop: 28 }}>Sent from this workspace</div>
            {visibleEmails.length === 0
              ? <div className="dash-empty">Nothing sent yet. Preview a conversation email first.</div>
              : visibleEmails.map((e, i) => <EmailRow key={e.id ?? i} entry={e} />)}
          </>
        )}

        {tab === 'settings' && (
          tenant
            ? <SettingsPanel tenant={tenant} />
            : <div className="dash-empty">No workspace assigned to this login.</div>
        )}

        {tab === 'tenants' && role === 'super' && (
          <SuperAdminPanel tenants={tenants} admins={admins} />
        )}
      </main>
    </div>
  );
}