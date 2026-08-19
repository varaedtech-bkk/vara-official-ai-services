import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { DashboardSession } from './types';
import { signPayload, verifyPayload } from './crypto';

export const SESSION_COOKIE = 'vara_dashboard_session';

type Stored = DashboardSession & { exp: number };

const WEEK = 60 * 60 * 24 * 7;

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    ...(process.env.NODE_ENV === 'production' ? { secure: true } : {}),
  };
}

function cookieValues(header: string | null, name: string): string[] {
  if (!header) return [];
  const out: string[] = [];
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    let value = part.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      value = decodeURIComponent(value);
    } catch {
      /* already decoded */
    }
    out.push(value);
  }
  return out;
}

function parseToken(raw: string): DashboardSession | null {
  if (!raw) return null;

  const signed = verifyPayload<Stored>(raw);
  if (signed && signed.exp > Date.now()) {
    return {
      role: signed.role,
      tenantId: signed.tenantId,
      adminId: signed.adminId,
      email: signed.email,
    };
  }

  // Legacy cookie: plaintext token from the first dashboard login.
  const legacy = process.env.LEADS_ACCESS_TOKEN || process.env.DASHBOARD_PASSWORD;
  if (legacy && raw === legacy) {
    return { role: 'super', email: 'super-admin' };
  }

  return null;
}

export function sessionFromRequest(req: Request): DashboardSession | null {
  for (const raw of cookieValues(req.headers.get('cookie'), SESSION_COOKIE)) {
    const session = parseToken(raw);
    if (session) return session;
  }
  return null;
}

export async function readSession(req?: Request): Promise<DashboardSession | null> {
  if (req) {
    const fromHeader = sessionFromRequest(req);
    if (fromHeader) return fromHeader;
  }

  const jar = await cookies();
  const listed = typeof jar.getAll === 'function' ? jar.getAll(SESSION_COOKIE) : [];
  for (const cookie of listed) {
    const session = parseToken(cookie.value);
    if (session) return session;
  }

  return parseToken(jar.get(SESSION_COOKIE)?.value ?? '');
}

export function attachSession(res: NextResponse, session: DashboardSession): NextResponse {
  const token = signPayload({ ...session, exp: Date.now() + WEEK * 1000 } satisfies Stored);
  // Drop the old path=/dashboard cookie that never reached /api/*.
  res.cookies.set(SESSION_COOKIE, '', { path: '/dashboard', maxAge: 0, expires: new Date(0) });
  res.cookies.set(SESSION_COOKIE, token, { ...cookieBase(), maxAge: WEEK });
  return res;
}

export function attachClearedSession(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, '', { ...cookieBase(), maxAge: 0, expires: new Date(0) });
  res.cookies.set(SESSION_COOKIE, '', { path: '/dashboard', maxAge: 0, expires: new Date(0) });
  return res;
}

/** Prefer attachSession on the Route Handler response so Set-Cookie is actually sent. */
export async function writeSession(session: DashboardSession) {
  const token = signPayload({ ...session, exp: Date.now() + WEEK * 1000 } satisfies Stored);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, '', { path: '/dashboard', maxAge: 0 });
  jar.set(SESSION_COOKIE, token, { ...cookieBase(), maxAge: WEEK });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete({ name: SESSION_COOKIE, path: '/' });
  jar.delete({ name: SESSION_COOKIE, path: '/dashboard' });
}

export function requireSuper(session: DashboardSession | null): session is DashboardSession {
  return session?.role === 'super';
}
