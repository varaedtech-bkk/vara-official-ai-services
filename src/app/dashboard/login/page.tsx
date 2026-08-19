'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { BrandMark } from '../BrandMark';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const emailValue = email.trim();
    const passwordValue = password.trim();
    let ok = true;
    setEmailError('');
    setPasswordError('');
    setError('');

    if (emailValue && !EMAIL_RE.test(emailValue)) {
      setEmailError('Enter a valid email, or leave this blank for super admin.');
      ok = false;
    }
    if (!passwordValue) {
      setPasswordError('Password is required.');
      ok = false;
    }
    return ok;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/auth', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim() || undefined,
          password: password.trim(),
        }),
      });
      if (res.ok) {
        router.push('/dashboard');
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === 'string' ? data.error : 'Incorrect email or password.');
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div className="dash-login">
      <form onSubmit={handleSubmit} className="dash-login-card" noValidate>
        <BrandMark logoUrl="/brand/vara-mark.png" companyName="VARA" size={40} />
        <div style={{ color: '#f4f5f7', fontSize: 22, fontWeight: 650, letterSpacing: '-0.03em', marginTop: 16 }}>
          Sign in to your workspace
        </div>
        <p style={{ color: '#8b939c', fontSize: 13, lineHeight: 1.55, margin: '8px 0 24px' }}>
          Super admin: leave email blank. Client admins: use the email you were issued.
        </p>

        <label className="dash-label" htmlFor="dash-email" style={{ color: '#8b939c' }}>
          Email
        </label>
        <input
          id="dash-email"
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError('');
          }}
          placeholder="optional for super admin"
          className="dash-input"
          disabled={loading}
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? 'dash-email-error' : undefined}
          style={{ background: 'rgba(255,255,255,0.04)', color: '#f4f5f7', borderColor: emailError ? '#f87171' : 'rgba(255,255,255,0.1)' }}
        />
        {emailError && (
          <p id="dash-email-error" className="dash-field-error">{emailError}</p>
        )}

        <label className="dash-label" htmlFor="dash-password" style={{ color: '#8b939c', marginTop: 14 }}>
          Password
        </label>
        <input
          id="dash-password"
          type="password"
          name="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (passwordError) setPasswordError('');
          }}
          className="dash-input"
          disabled={loading}
          aria-invalid={Boolean(passwordError)}
          aria-describedby={passwordError ? 'dash-password-error' : undefined}
          style={{ background: 'rgba(255,255,255,0.04)', color: '#f4f5f7', borderColor: passwordError ? '#f87171' : 'rgba(255,255,255,0.1)' }}
        />
        {passwordError && (
          <p id="dash-password-error" className="dash-field-error">{passwordError}</p>
        )}

        {error && (
          <div className="dash-banner dash-banner-err" style={{ marginTop: 12, marginBottom: 0 }} role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="dash-btn dash-btn-primary"
          style={{ marginTop: 20, width: '100%', padding: 12 }}
          aria-busy={loading}
        >
          {loading ? (
            <>
              <span className="dash-spinner" aria-hidden />
              Signing in…
            </>
          ) : (
            'Continue'
          )}
        </button>
      </form>
    </div>
  );
}
