'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { BrandMark } from '../BrandMark';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/auth', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() || undefined, password }),
      });
      if (res.ok) {
        router.push('/dashboard');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Incorrect password.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dash-login">
      <form onSubmit={handleSubmit} className="dash-login-card">
        <BrandMark logoUrl="/brand/vara-mark.png" companyName="VARA" size={40} />
        <div style={{ color: '#f4f5f7', fontSize: 22, fontWeight: 650, letterSpacing: '-0.03em', marginTop: 16 }}>
          Sign in to your workspace
        </div>
        <p style={{ color: '#8b939c', fontSize: 13, lineHeight: 1.55, margin: '8px 0 24px' }}>
          Super admin: leave email blank. Client admins: use the email you were issued.
        </p>
        <label className="dash-label" style={{ color: '#8b939c' }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="optional for super admin"
          className="dash-input"
          style={{ background: 'rgba(255,255,255,0.04)', color: '#f4f5f7', borderColor: 'rgba(255,255,255,0.1)' }}
        />
        <label className="dash-label" style={{ color: '#8b939c', marginTop: 14 }}>Password</label>
        <input
          type="password"
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="dash-input"
          style={{ background: 'rgba(255,255,255,0.04)', color: '#f4f5f7', borderColor: 'rgba(255,255,255,0.1)' }}
        />
        {error && (
          <div className="dash-banner dash-banner-err" style={{ marginTop: 12, marginBottom: 0 }}>{error}</div>
        )}
        <button
          type="submit"
          disabled={loading || !password}
          className="dash-btn dash-btn-primary"
          style={{ marginTop: 20, width: '100%', padding: 12, opacity: loading || !password ? 0.45 : 1 }}
        >
          {loading ? 'Signing in…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
