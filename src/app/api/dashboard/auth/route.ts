import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { attachClearedSession, attachSession } from '@/lib/saas/session';
import { findAdminByEmail, getTenant, isTenantActive } from '@/lib/saas/store';
import { verifyPassword } from '@/lib/saas/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function passwordsMatch(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** POST /api/dashboard/auth — super password, or tenant admin email + password */
export async function POST(req: NextRequest) {
  let body: { password?: string; email?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const password = typeof body.password === 'string' ? body.password.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!password) {
    return Response.json({ error: 'Password is required.' }, { status: 400 });
  }
  if (email && !EMAIL_RE.test(email)) {
    return Response.json(
      { error: 'Enter a valid email, or leave it blank for super admin.' },
      { status: 400 },
    );
  }

  /* ---- tenant admin ---- */
  if (email) {
    const admin = findAdminByEmail(email);
    if (!admin || !admin.active || !verifyPassword(password, admin.passwordHash)) {
      return Response.json({ error: 'Incorrect email or password.' }, { status: 401 });
    }
    const tenant = getTenant(admin.tenantId);
    if (!tenant || !isTenantActive(tenant)) {
      return Response.json(
        { error: 'This workspace is paused. Ask the platform owner to renew it.' },
        { status: 403 },
      );
    }
    return attachSession(NextResponse.json({ ok: true, role: 'admin' }), {
      role: 'admin',
      tenantId: admin.tenantId,
      adminId: admin.id,
      email: admin.email,
    });
  }

  /* ---- super admin ---- */
  const superPassword = (process.env.DASHBOARD_PASSWORD || '').trim();
  if (!superPassword) {
    return Response.json({ error: 'DASHBOARD_PASSWORD is not configured on the server.' }, { status: 503 });
  }
  if (!passwordsMatch(password, superPassword)) {
    return Response.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  return attachSession(NextResponse.json({ ok: true, role: 'super' }), {
    role: 'super',
    email: 'super-admin',
  });
}

export async function DELETE() {
  return attachClearedSession(NextResponse.json({ ok: true }));
}
