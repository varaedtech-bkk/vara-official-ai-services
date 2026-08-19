import type { NextRequest } from 'next/server';
import { readLeads, leadsToCsv } from '@/lib/leads';
import { readSession } from '@/lib/saas/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await readSession(req);
  const queryToken = req.nextUrl.searchParams.get('token') ?? '';
  const bearerToken = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const legacy = process.env.LEADS_ACCESS_TOKEN;
  const ok = Boolean(session) || (legacy && (queryToken === legacy || bearerToken === legacy));

  if (!ok) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let leads = readLeads();
  if (session?.role === 'admin' && session.tenantId) {
    leads = leads.filter((l) => l.tenantId === session.tenantId || l.tenantSlug === session.tenantId);
  }

  if (req.nextUrl.searchParams.get('format') === 'csv') {
    return new Response(leadsToCsv(leads), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="vara-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return Response.json({ count: leads.length, leads }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
