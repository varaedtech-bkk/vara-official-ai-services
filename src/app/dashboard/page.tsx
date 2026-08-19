import { redirect } from 'next/navigation';
import { readLeads } from '@/lib/leads';
import { readEmailLog } from '@/lib/email';
import type { VapiCall } from '@/app/api/vapi/calls/route';
import { readSession } from '@/lib/saas/session';
import { getTenant, publicAdmin, publicTenant, readAdmins, readTenants } from '@/lib/saas/store';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

async function fetchVapiCalls(): Promise<VapiCall[]> {
  const privateKey = process.env.VAPI_PRIVATE_KEY;
  if (!privateKey) return [];

  const assistantIds = [
    process.env.VAPI_ASSISTANT_ID_EN,
    process.env.VAPI_ASSISTANT_ID_TH,
  ].filter(Boolean) as string[];

  if (!assistantIds.length) return [];

  try {
    const results = await Promise.all(
      assistantIds.map(async (assistantId) => {
        const url = new URL('https://api.vapi.ai/call');
        url.searchParams.set('assistantId', assistantId);
        url.searchParams.set('limit', '200');

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${privateKey}` },
          cache: 'no-store',
        });

        if (!res.ok) return [] as VapiCall[];
        const data: unknown = await res.json();
        return Array.isArray(data) ? (data as VapiCall[]) : [];
      }),
    );

    const seen = new Set<string>();
    const merged: VapiCall[] = [];
    for (const batch of results) {
      for (const call of batch) {
        if (!seen.has(call.id)) {
          seen.add(call.id);
          merged.push({ ...call, summary: call.summary || call.analysis?.summary });
        }
      }
    }
    merged.sort(
      (a, b) =>
        Date.parse(b.startedAt ?? b.createdAt) - Date.parse(a.startedAt ?? a.createdAt),
    );
    return merged;
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  if (!process.env.DASHBOARD_PASSWORD) {
    return (
      <main style={{ fontFamily: 'sans-serif', padding: '48px', maxWidth: 540 }}>
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>Dashboard unavailable</h1>
        <p style={{ color: '#666', lineHeight: 1.6 }}>
          Set <code>DASHBOARD_PASSWORD</code> in your <code>.env</code> file to enable
          this dashboard, then restart the server.
        </p>
      </main>
    );
  }

  const session = await readSession();
  if (!session) redirect('/dashboard/login');

  const tenant = session.tenantId ? getTenant(session.tenantId) : getTenant('vara');

  let leads = readLeads();
  if (session.role === 'admin' && session.tenantId) {
    leads = leads.filter(
      (l) => l.tenantId === session.tenantId || l.tenantSlug === tenant?.slug,
    );
  }

  const [vapiCalls, emailLog] = await Promise.all([
    fetchVapiCalls(),
    Promise.resolve(readEmailLog()),
  ]);

  return (
    <DashboardClient
      leads={leads}
      vapiCalls={vapiCalls}
      emailLog={emailLog}
      role={session.role}
      tenant={tenant ? publicTenant(tenant) : null}
      tenants={session.role === 'super' ? readTenants().map(publicTenant) : []}
      admins={session.role === 'super' ? readAdmins().map(publicAdmin) : []}
    />
  );
}
