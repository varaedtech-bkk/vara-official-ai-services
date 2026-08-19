'use client';

import { useState } from 'react';
import type { Skill } from '@/lib/saas/types';

export type TenantConfigView = {
  id: string;
  slug: string;
  companyName: string;
  assistantName: string;
  website?: string;
  logoUrl?: string;
  extraInstructions?: string;
  skills: Skill[];
  status?: 'active' | 'paused' | 'expired';
  paidUntil?: string;
  notes?: string;
  smtp?: {
    host: string;
    port: number;
    user: string;
    from?: string;
    replyTo?: string;
    passSet?: boolean;
  };
};

type SectionId = 'brand' | 'skills' | 'mail';

export default function SettingsPanel({ tenant: initial }: { tenant: TenantConfigView }) {
  const [tenant, setTenant] = useState(initial);
  const [smtpPass, setSmtpPass] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<SectionId>('brand');

  function patch<K extends keyof TenantConfigView>(key: K, value: TenantConfigView[K]) {
    setTenant((t) => ({ ...t, [key]: value }));
  }

  async function onLogo(file: File) {
    if (file.size > 400_000) {
      setErr(true);
      setMsg('Logo must be under 400 KB.');
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    patch('logoUrl', dataUrl);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    const res = await fetch('/api/dashboard/tenant-config', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: tenant.id,
        companyName: tenant.companyName,
        assistantName: tenant.assistantName,
        website: tenant.website,
        logoUrl: tenant.logoUrl,
        extraInstructions: tenant.extraInstructions,
        skills: tenant.skills,
        smtp: {
          host: tenant.smtp?.host ?? '',
          port: tenant.smtp?.port ?? 587,
          user: tenant.smtp?.user ?? '',
          from: tenant.smtp?.from,
          replyTo: tenant.smtp?.replyTo,
          pass: smtpPass || (tenant.smtp?.passSet ? '••••••••' : ''),
        },
      }),
    });
    const data = await res.json();
    setSaving(false);
    setErr(!res.ok);
    setMsg(res.ok ? 'Saved. Name, skills and SMTP apply on the next call.' : data.error);
    if (res.ok && data.tenant) setTenant(data.tenant);
  }

  return (
    <form onSubmit={save} className="dash-split">
      <nav className="dash-subnav">
        {([
          ['brand', 'Brand'],
          ['skills', 'Skills'],
          ['mail', 'Email SMTP'],
        ] as const).map(([id, label]) => (
          <button type="button" key={id} className={section === id ? 'is-on' : ''} onClick={() => setSection(id)}>
            {label}
          </button>
        ))}
      </nav>

      <div>
        {msg && <div className={`dash-banner ${err ? 'dash-banner-err' : 'dash-banner-ok'}`}>{msg}</div>}

        {section === 'brand' && (
          <div className="dash-card" style={{ padding: 22 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>How the assistant appears</h2>
            <p className="dash-hint" style={{ marginBottom: 16 }}>
              Public page: <a href={`/t/${tenant.slug}`}>/t/{tenant.slug}</a>
            </p>
            <div className="dash-grid-2">
              <label>
                <span className="dash-label">Assistant name</span>
                <input className="dash-input" value={tenant.assistantName} onChange={(e) => patch('assistantName', e.target.value)} />
                <div className="dash-hint">Spoken first, like Siri — Sara, Maya, Alex.</div>
              </label>
              <label>
                <span className="dash-label">Company</span>
                <input className="dash-input" value={tenant.companyName} onChange={(e) => patch('companyName', e.target.value)} />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                <span className="dash-label">Website</span>
                <input className="dash-input" value={tenant.website ?? ''} onChange={(e) => patch('website', e.target.value)} />
              </label>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
              {tenant.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tenant.logoUrl} alt="" style={{ height: 40, maxWidth: 160, objectFit: 'contain' }} />
              )}
              <label>
                <span className="dash-label">Logo</span>
                <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void onLogo(e.target.files[0])} />
                <div className="dash-hint">PNG or SVG, under 400 KB.</div>
              </label>
            </div>
          </div>
        )}

        {section === 'skills' && (
          <div>
            <div className="dash-card" style={{ padding: 22, marginBottom: 12 }}>
              <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>What it can talk about</h2>
              <p className="dash-hint">Each skill is a topic. The voice assistant uses these on the next call.</p>
            </div>
            {tenant.skills.map((s, i) => (
              <div key={s.id} className="dash-card" style={{ padding: 18, marginBottom: 10 }}>
                <label>
                  <span className="dash-label">Title</span>
                  <input className="dash-input" value={s.title} onChange={(e) => {
                    const skills = [...tenant.skills];
                    skills[i] = { ...s, title: e.target.value };
                    patch('skills', skills);
                  }} />
                </label>
                <label style={{ display: 'block', marginTop: 12 }}>
                  <span className="dash-label">What it should know</span>
                  <textarea className="dash-textarea" value={s.body} onChange={(e) => {
                    const skills = [...tenant.skills];
                    skills[i] = { ...s, body: e.target.value };
                    patch('skills', skills);
                  }} />
                </label>
                <button type="button" className="dash-btn dash-btn-danger" style={{ marginTop: 10 }} onClick={() => patch('skills', tenant.skills.filter((_, j) => j !== i))}>
                  Remove skill
                </button>
              </div>
            ))}
            <button
              type="button"
              className="dash-btn dash-btn-ghost"
              onClick={() => patch('skills', [...tenant.skills, { id: `s${Date.now()}`, title: '', body: '' }])}
            >
              Add skill
            </button>
            <div className="dash-card" style={{ padding: 18, marginTop: 16 }}>
              <label>
                <span className="dash-label">Extra spoken instructions</span>
                <textarea className="dash-textarea" value={tenant.extraInstructions ?? ''} placeholder="Tone, languages, things it must never say…" onChange={(e) => patch('extraInstructions', e.target.value)} />
              </label>
            </div>
          </div>
        )}

        {section === 'mail' && (
          <div className="dash-card" style={{ padding: 22 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>Follow-up email</h2>
            <p className="dash-hint" style={{ marginBottom: 16 }}>Leave blank to use VARA’s mailer. Fill this to send from the client’s mailbox.</p>
            <div className="dash-grid-2">
              <label>
                <span className="dash-label">SMTP host</span>
                <input className="dash-input" value={tenant.smtp?.host ?? ''} onChange={(e) => patch('smtp', { ...tenant.smtp, host: e.target.value, port: tenant.smtp?.port ?? 587, user: tenant.smtp?.user ?? '' })} />
              </label>
              <label>
                <span className="dash-label">Port</span>
                <input className="dash-input" value={String(tenant.smtp?.port ?? 587)} onChange={(e) => patch('smtp', { ...tenant.smtp, host: tenant.smtp?.host ?? '', port: Number(e.target.value) || 587, user: tenant.smtp?.user ?? '' })} />
              </label>
              <label>
                <span className="dash-label">Username</span>
                <input className="dash-input" value={tenant.smtp?.user ?? ''} onChange={(e) => patch('smtp', { ...tenant.smtp, host: tenant.smtp?.host ?? '', port: tenant.smtp?.port ?? 587, user: e.target.value })} />
              </label>
              <label>
                <span className="dash-label">Password</span>
                <input className="dash-input" type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} />
                {tenant.smtp?.passSet && <div className="dash-hint">Already saved. Type a new one only to replace it.</div>}
              </label>
              <label>
                <span className="dash-label">From</span>
                <input className="dash-input" value={tenant.smtp?.from ?? ''} onChange={(e) => patch('smtp', { ...tenant.smtp, host: tenant.smtp?.host ?? '', port: tenant.smtp?.port ?? 587, user: tenant.smtp?.user ?? '', from: e.target.value })} />
              </label>
              <label>
                <span className="dash-label">Reply-To</span>
                <input className="dash-input" value={tenant.smtp?.replyTo ?? ''} onChange={(e) => patch('smtp', { ...tenant.smtp, host: tenant.smtp?.host ?? '', port: tenant.smtp?.port ?? 587, user: tenant.smtp?.user ?? '', replyTo: e.target.value })} />
              </label>
            </div>
          </div>
        )}

        <div className="dash-sticky-save">
          <button type="submit" className="dash-btn dash-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save workspace'}
          </button>
        </div>
      </div>
    </form>
  );
}
