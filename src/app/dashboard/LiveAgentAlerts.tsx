'use client';

import { useEffect, useState } from 'react';

export default function LiveAgentAlerts() {
  const [emails, setEmails] = useState('ceo@varaedtech.com');
  const [whatsapp, setWhatsapp] = useState('66948877955');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch('/api/dashboard/platform', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.liveAgentEmails === 'string') setEmails(data.liveAgentEmails);
        if (typeof data.urgentWhatsapp === 'string') setWhatsapp(data.urgentWhatsapp);
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    const res = await fetch('/api/dashboard/platform', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ liveAgentEmails: emails, urgentWhatsapp: whatsapp }),
    });
    const data = await res.json();
    setSaving(false);
    setErr(!res.ok);
    setMsg(res.ok ? 'Live agent alerts saved.' : data.error || 'Save failed');
    if (res.ok) {
      if (typeof data.liveAgentEmails === 'string') setEmails(data.liveAgentEmails);
      if (typeof data.urgentWhatsapp === 'string') setWhatsapp(data.urgentWhatsapp);
    }
  }

  return (
    <div className="dash-card" style={{ padding: 22, marginBottom: 20 }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>Live agent alerts</h2>
      <p className="dash-hint" style={{ marginBottom: 14 }}>
        Visitors are never connected to a live agent in the assistant. When they ask for a person, Sunny first asks for name and email or phone, then we email this list. Default is ceo@varaedtech.com. Urgent WhatsApp is shown to the visitor.
      </p>
      {msg && <div className={`dash-banner ${err ? 'dash-banner-err' : 'dash-banner-ok'}`}>{msg}</div>}
      <form onSubmit={save} className="dash-grid-2">
        <label style={{ gridColumn: '1 / -1' }}>
          <span className="dash-label">Internal alert emails</span>
          <textarea
            className="dash-textarea"
            rows={4}
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="ceo@varaedtech.com"
          />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          <span className="dash-label">Urgent WhatsApp</span>
          <input
            className="dash-input"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+66948877955"
          />
        </label>
        <button type="submit" className="dash-btn dash-btn-primary" disabled={saving} style={{ justifySelf: 'start' }}>
          {saving ? 'Saving…' : 'Save alerts'}
        </button>
      </form>
    </div>
  );
}
