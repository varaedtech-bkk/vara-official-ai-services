import { readSession } from '@/lib/saas/session';
import {
  createAdmin,
  getTenant,
  publicAdmin,
  publicTenant,
  readAdmins,
  readTenants,
  resetAdminPassword,
  setAdminActive,
  upsertTenant,
} from '@/lib/saas/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await readSession(req);
  if (session?.role !== 'super') {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  return Response.json({
    tenants: readTenants().map(publicTenant),
    admins: readAdmins().map(publicAdmin),
  });
}

/** Create or update a tenant (manual subscription). */
export async function POST(req: Request) {
  const session = await readSession(req);
  if (session?.role !== 'super') {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  try {
    const tenant = upsertTenant({
      id: typeof body.id === 'string' ? body.id : undefined,
      companyName: String(body.companyName ?? ''),
      slug: String(body.slug ?? ''),
      assistantName: typeof body.assistantName === 'string' ? body.assistantName : undefined,
      website: typeof body.website === 'string' ? body.website : undefined,
      status: body.status === 'paused' || body.status === 'expired' || body.status === 'active'
        ? body.status
        : undefined,
      paidUntil: typeof body.paidUntil === 'string' ? body.paidUntil : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
    });
    return Response.json({ ok: true, tenant: publicTenant(tenant) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Could not save tenant' }, { status: 400 });
  }
}

/** Create / pause tenant admins, or reset a password. */
export async function PUT(req: Request) {
  const session = await readSession(req);
  if (session?.role !== 'super') {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  const action = String(body.action ?? 'create');

  try {
    if (action === 'create') {
      if (!getTenant(String(body.tenantId ?? ''))) {
        return Response.json({ error: 'tenant not found' }, { status: 404 });
      }
      const admin = createAdmin({
        email: String(body.email ?? ''),
        name: String(body.name ?? ''),
        tenantId: String(body.tenantId ?? ''),
        password: String(body.password ?? ''),
      });
      return Response.json({ ok: true, admin: publicAdmin(admin) });
    }

    if (action === 'set-active') {
      const admin = setAdminActive(String(body.id ?? ''), Boolean(body.active));
      if (!admin) return Response.json({ error: 'admin not found' }, { status: 404 });
      return Response.json({ ok: true, admin: publicAdmin(admin) });
    }

    if (action === 'reset-password') {
      const admin = resetAdminPassword(String(body.id ?? ''), String(body.password ?? ''));
      if (!admin) return Response.json({ error: 'admin not found' }, { status: 404 });
      return Response.json({ ok: true, admin: publicAdmin(admin) });
    }

    return Response.json({ error: 'unknown action' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Could not update admin' }, { status: 400 });
  }
}
