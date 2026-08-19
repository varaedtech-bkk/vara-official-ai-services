import { handleDashboardSendEmail } from '@/lib/dashboard/sendEmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }

  const result = await handleDashboardSendEmail(body, req);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(result);
}
