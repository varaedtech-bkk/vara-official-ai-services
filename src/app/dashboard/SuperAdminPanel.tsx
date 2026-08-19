'use client';

import { useState } from 'react';
import type { TenantConfigView } from './SettingsPanel';

type AdminRow = {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  active: boolean;
  createdAt: string;
};

export default function SuperAdminPanel({
  tenants: initialTenants,
  admins: initialAdmins,
}: {
  tenants: TenantConfigView[];
  admins: AdminRow[];
}) {
  const [tenants, setTenants] = useState(initialTenants);
  const [admins, setAdmins] = useState(initialAdmins);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState(false);
  const [tenantForm, setTenantForm] = useState({
    companyName: '',
    slug: '',
    assistantName: 'Sara',
    paidUntil: '',
    notes: '',
  });
  const [adminForm, setAdminForm] = useState({
    tenantId: '',
    name: '',
    email: '',
    password: '',
  });

  async function refresh() {
    const res = await fetch('/api/dashboard/tenants', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    setTenants(data.tenants);
    setAdmins(data.admins);
  }

  async function saveTenant(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/dashboard/tenants', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...tenantForm,
        status: 'active',
        paidUntil: tenantForm.paidUntil || undefined,
      }),
    });
    const data = await res.json();
    setErr(!res.ok);
    setMsg(res.ok ? `Workspace ${data.tenant.slug} is live.` : data.error);
    if (res.ok) {
      setTenantForm({ companyName: '', slug: '', assistantName: 'Sara', paidUntil: '', notes: '' });
      await refresh();
    }
  }

  async function setStatus(id: string, status: 'active' | 'paused') {
    const t = tenants.find((x) => x.id === id);
    if (!t) return;
    await fetch('/api/dashboard/tenants', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: t.id,
        companyName: t.companyName,
        slug: t.slug,
        assistantName: t.assistantName,
        status,
        paidUntil: t.paidUntil,
        notes: t.notes,
      }),
    });
    await refresh();
  }

  async function addAdmin(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/dashboard/tenants', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', ...adminForm }),
    });
    const data = await res.json();
    setErr(!res.ok);
    setMsg(res.ok ? `Admin ${data.admin.email} created.` : data.error);
    if (res.ok) {
      setAdminForm({ tenantId: adminForm.tenantId, name: '', email: '', password: '' });
      await refresh();
    }
  }

  return (
    <div>
      {msg && <div className={`dash-banner ${err ? 'dash-banner-err' : 'dash-banner-ok'}`}>{msg}</div>}

      <div className="dash-card" style={{ padding: 22, marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>New workspace</h2>
        <p className="dash-hint" style={{ marginBottom: 14 }}>Manual subscription — no payment provider. Activate or pause any time.</p>
        <form onSubmit={saveTenant} className="dash-grid-2">
          <label>
            <span className="dash-label">Company</span>
            <input className="dash-input" required value={tenantForm.companyName} onChange={(e) => setTenantForm({ ...tenantForm, companyName: e.target.value, slug: tenantForm.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') })} />
          </label>
          <label>
            <span className="dash-label">Slug</span>
            <input className="dash-input" required value={tenantForm.slug} onChange={(e) => setTenantForm({ ...tenantForm, slug: e.target.value })} />
            <div className="dash-hint">Assistant URL: /t/{tenantForm.slug || 'slug'}</div>
          </label>
          <label>
            <span className="dash-label">Assistant name</span>
            <input className="dash-input" value={tenantForm.assistantName} onChange={(e) => setTenantForm({ ...tenantForm, assistantName: e.target.value })} />
          </label>
          <label>
            <span className="dash-label">Paid until</span>
            <input className="dash-input" type="date" value={tenantForm.paidUntil} onChange={(e) => setTenantForm({ ...tenantForm, paidUntil: e.target.value })} />
            <div className="dash-hint">Blank means no expiry.</div>
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            <span className="dash-label">Internal notes</span>
            <input className="dash-input" value={tenantForm.notes} onChange={(e) => setTenantForm({ ...tenantForm, notes: e.target.value })} />
          </label>
          <button type="submit" className="dash-btn dash-btn-primary" style={{ gridColumn: '1 / -1', justifySelf: 'start' }}>Create workspace</button>
        </form>
      </div>

      <div className="dash-card" style={{ overflow: 'hidden', marginBottom: 24 }}>
        {tenants.map((t) => (
          <div key={t.id} className="dash-table-row">
            <div>
              <div style={{ fontWeight: 650 }}>{t.companyName} · {t.assistantName}</div>
              <div className="dash-hint" style={{ marginTop: 2 }}>
                /t/{t.slug} · {t.status}{t.paidUntil ? ` · paid until ${t.paidUntil.slice(0, 10)}` : ' · open-ended'}
              </div>
            </div>
            {t.status === 'active'
              ? <button type="button" className="dash-btn dash-btn-ghost" onClick={() => setStatus(t.id, 'paused')}>Pause</button>
              : <button type="button" className="dash-btn dash-btn-primary" onClick={() => setStatus(t.id, 'active')}>Activate</button>}
          </div>
        ))}
      </div>

      <div className="dash-card" style={{ padding: 22, marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>Paid admin</h2>
        <p className="dash-hint" style={{ marginBottom: 14 }}>They sign in at /dashboard with this email and password.</p>
        <form onSubmit={addAdmin} className="dash-grid-2">
          <label>
            <span className="dash-label">Workspace</span>
            <select className="dash-select" required value={adminForm.tenantId} onChange={(e) => setAdminForm({ ...adminForm, tenantId: e.target.value })} style={{ width: '100%' }}>
              <option value="">Select…</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.companyName}</option>)}
            </select>
          </label>
          <label>
            <span className="dash-label">Name</span>
            <input className="dash-input" value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })} />
          </label>
          <label>
            <span className="dash-label">Email</span>
            <input className="dash-input" type="email" required value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} />
          </label>
          <label>
            <span className="dash-label">Temporary password</span>
            <input className="dash-input" type="text" required minLength={8} value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} />
          </label>
          <button type="submit" className="dash-btn dash-btn-primary" style={{ gridColumn: '1 / -1', justifySelf: 'start' }}>Add admin</button>
        </form>
      </div>

      <div className="dash-card" style={{ overflow: 'hidden' }}>
        {admins.length === 0 && <div className="dash-empty">No paid admins yet.</div>}
        {admins.map((a) => {
          const tenant = tenants.find((t) => t.id === a.tenantId);
          return (
            <div key={a.id} className="dash-table-row">
              <div>
                <div style={{ fontWeight: 650 }}>{a.name} · {a.email}</div>
                <div className="dash-hint" style={{ marginTop: 2 }}>{tenant?.companyName ?? a.tenantId} · {a.active ? 'can sign in' : 'disabled'}</div>
              </div>
              <button
                type="button"
                className="dash-btn dash-btn-ghost"
                onClick={async () => {
                  await fetch('/api/dashboard/tenants', {
                    method: 'PUT',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'set-active', id: a.id, active: !a.active }),
                  });
                  await refresh();
                }}
              >
                {a.active ? 'Disable' : 'Enable'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
