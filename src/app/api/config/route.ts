import { getTenant, isTenantActive } from '@/lib/saas/store';
import { publicBrand, voiceVariableValues } from '@/lib/saas/brand';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public client configuration, including optional tenant branding.
 * GET /api/config?slug=acme
 */
export async function GET(req: Request) {
  const publicKey = (process.env.VAPI_PUBLIC_KEY || '').trim();
  const assistantEn = (process.env.VAPI_ASSISTANT_ID_EN || '').trim();
  const assistantTh = (process.env.VAPI_ASSISTANT_ID_TH || '').trim();

  const slug = new URL(req.url).searchParams.get('slug') || 'vara';
  const tenant = getTenant(slug) || getTenant('vara');
  const active = tenant ? isTenantActive(tenant) : false;

  return Response.json(
    {
      publicKey: publicKey || null,
      assistants: {
        en: assistantEn || null,
        th: assistantTh || null,
      },
      textChatEnabled: Boolean((process.env.ANTHROPIC_API_KEY || '').trim()),
      configured: Boolean(publicKey && (assistantEn || assistantTh) && active),
      tenant: tenant ? { ...publicBrand(tenant), ...voiceVariableValues(tenant) } : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
