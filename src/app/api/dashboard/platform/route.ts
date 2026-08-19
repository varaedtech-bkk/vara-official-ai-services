import { readSession } from '@/lib/saas/session';
import { readPlatformConfig, writePlatformConfig } from '@/lib/saas/platform';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await readSession(req);
  if (session?.role !== 'super') {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const config = readPlatformConfig();
  return Response.json({
    liveAgentEmails: config.liveAgentEmails.join('\n'),
    urgentWhatsapp: config.urgentWhatsapp,
  });
}

export async function POST(req: Request) {
  const session = await readSession(req);
  if (session?.role !== 'super') {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { liveAgentEmails?: string; urgentWhatsapp?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  try {
    const config = writePlatformConfig({
      liveAgentEmails: typeof body.liveAgentEmails === 'string' ? body.liveAgentEmails : '',
      urgentWhatsapp: typeof body.urgentWhatsapp === 'string' ? body.urgentWhatsapp : '',
    });
    return Response.json({
      ok: true,
      liveAgentEmails: config.liveAgentEmails.join('\n'),
      urgentWhatsapp: config.urgentWhatsapp,
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'save failed' }, { status: 400 });
  }
}
