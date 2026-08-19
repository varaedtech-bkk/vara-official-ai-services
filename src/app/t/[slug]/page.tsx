import AssistantExperience from '@/components/AssistantExperience';
import { getTenant, isTenantActive } from '@/lib/saas/store';

export const dynamic = 'force-dynamic';

export default async function TenantAssistantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = getTenant(slug);

  if (!tenant) {
    return (
      <main style={{ fontFamily: 'system-ui', padding: 48, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22 }}>Workspace not found</h1>
        <p style={{ color: '#666' }}>Ask VARA EdTech for your assistant link.</p>
      </main>
    );
  }

  if (!isTenantActive(tenant)) {
    return (
      <main style={{ fontFamily: 'system-ui', padding: 48, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22 }}>{tenant.companyName}</h1>
        <p style={{ color: '#666' }}>This assistant is paused. Contact VARA EdTech to renew the workspace.</p>
      </main>
    );
  }

  return <AssistantExperience slug={tenant.slug} />;
}
