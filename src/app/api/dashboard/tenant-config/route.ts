import { randomUUID } from 'node:crypto';
import { readSession } from '@/lib/saas/session';
import { getTenant, publicTenant, upsertTenant } from '@/lib/saas/store';
import type { Skill, TenantSmtp } from '@/lib/saas/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function tenantIdFor(session: { role: string; tenantId?: string }, requested?: string) {
  if (session.role === 'super') return requested || session.tenantId;
  return session.tenantId;
}

export async function GET(req: Request) {
  const session = await readSession(req);
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const id = tenantIdFor(session, url.searchParams.get('tenantId') ?? undefined);
  if (!id) return Response.json({ error: 'no tenant' }, { status: 400 });

  const tenant = getTenant(id);
  if (!tenant) return Response.json({ error: 'not found' }, { status: 404 });
  if (session.role === 'admin' && tenant.id !== session.tenantId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  return Response.json({ tenant: publicTenant(tenant) });
}

export async function POST(req: Request) {
  const session = await readSession(req);
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  const id = tenantIdFor(session, typeof body.tenantId === 'string' ? body.tenantId : undefined);
  if (!id) return Response.json({ error: 'no tenant' }, { status: 400 });

  const existing = getTenant(id);
  if (!existing) return Response.json({ error: 'not found' }, { status: 404 });
  if (session.role === 'admin' && existing.id !== session.tenantId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const skills = Array.isArray(body.skills)
    ? (body.skills as Skill[]).map((s) => ({
        id: s.id || randomUUID(),
        title: String(s.title ?? '').trim(),
        body: String(s.body ?? '').trim(),
      })).filter((s) => s.title && s.body)
    : existing.skills;

  let smtp = existing.smtp;
  if (body.smtp && typeof body.smtp === 'object') {
    const s = body.smtp as Record<string, unknown>;
    const nextPass = typeof s.pass === 'string' ? s.pass : '';
    smtp = {
      host: String(s.host ?? existing.smtp?.host ?? ''),
      port: Number(s.port ?? existing.smtp?.port ?? 587),
      user: String(s.user ?? existing.smtp?.user ?? ''),
      pass: nextPass && nextPass !== '••••••••' ? nextPass : existing.smtp?.pass ?? '',
      from: typeof s.from === 'string' ? s.from : existing.smtp?.from,
      replyTo: typeof s.replyTo === 'string' ? s.replyTo : existing.smtp?.replyTo,
    } satisfies TenantSmtp;
    if (!smtp.host) smtp = undefined;
  }

  try {
    const tenant = upsertTenant({
      id: existing.id,
      slug: existing.slug,
      companyName: typeof body.companyName === 'string' ? body.companyName : existing.companyName,
      assistantName: typeof body.assistantName === 'string' ? body.assistantName : existing.assistantName,
      website: typeof body.website === 'string' ? body.website : existing.website,
      logoUrl: typeof body.logoUrl === 'string' ? body.logoUrl : existing.logoUrl,
      extraInstructions:
        typeof body.extraInstructions === 'string' ? body.extraInstructions : existing.extraInstructions,
      skills,
      smtp,
      status: existing.status,
      paidUntil: existing.paidUntil,
    });
    return Response.json({ ok: true, tenant: publicTenant(tenant) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'save failed' }, { status: 400 });
  }
}
