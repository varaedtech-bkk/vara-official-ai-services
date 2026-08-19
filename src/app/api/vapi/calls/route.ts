import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type VapiCall = {
  id: string;
  assistantId?: string;
  type: string;
  status: string;
  endedReason?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  cost?: number;
  transcript?: string;
  summary?: string;
  recordingUrl?: string;
  stereoRecordingUrl?: string;
  webCallUrl?: string;
  analysis?: {
    summary?: string;
    structuredData?: Record<string, unknown>;
    successEvaluation?: string;
  };
  costBreakdown?: Record<string, unknown>;
};

/**
 * GET /api/vapi/calls?token=...
 *
 * Fetches call logs from the Vapi REST API using VAPI_PRIVATE_KEY.
 * Protected by the same LEADS_ACCESS_TOKEN as the dashboard.
 * Optional query param: limit (default 100), assistantId
 */
export async function GET(req: NextRequest) {
  const expected = process.env.LEADS_ACCESS_TOKEN;
  if (!expected) {
    return Response.json({ error: 'LEADS_ACCESS_TOKEN not configured' }, { status: 503 });
  }

  const provided =
    req.nextUrl.searchParams.get('token') ||
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');

  if (provided !== expected) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const privateKey = process.env.VAPI_PRIVATE_KEY;
  if (!privateKey) {
    return Response.json({ error: 'VAPI_PRIVATE_KEY not configured' }, { status: 503 });
  }

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 100), 1000);

  // Fetch from both assistants so we capture EN + TH calls.
  const assistantIds = [
    process.env.VAPI_ASSISTANT_ID_EN,
    process.env.VAPI_ASSISTANT_ID_TH,
  ].filter(Boolean) as string[];

  if (!assistantIds.length) {
    return Response.json({ error: 'No assistant IDs configured' }, { status: 503 });
  }

  try {
    const results = await Promise.all(
      assistantIds.map(async (assistantId) => {
        const url = new URL('https://api.vapi.ai/call');
        url.searchParams.set('assistantId', assistantId);
        url.searchParams.set('limit', String(limit));

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${privateKey}` },
          next: { revalidate: 0 },
        });

        if (!res.ok) {
          console.error(`[vapi/calls] Vapi API error ${res.status} for assistant ${assistantId}`);
          return [] as VapiCall[];
        }

        const data: unknown = await res.json();
        return Array.isArray(data) ? (data as VapiCall[]) : [];
      }),
    );

    // Merge EN + TH, dedupe by id, sort newest first.
    const seen = new Set<string>();
    const merged: VapiCall[] = [];
    for (const batch of results) {
      for (const call of batch) {
        if (!seen.has(call.id)) {
          seen.add(call.id);
          // Promote analysis.summary to top-level for convenience.
          merged.push({
            ...call,
            summary: call.summary || call.analysis?.summary,
          });
        }
      }
    }

    merged.sort(
      (a, b) =>
        Date.parse(b.startedAt ?? b.createdAt) - Date.parse(a.startedAt ?? a.createdAt),
    );

    return Response.json(
      { count: merged.length, calls: merged },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error('[vapi/calls] fetch error', err);
    return Response.json({ error: 'Failed to fetch calls from Vapi' }, { status: 502 });
  }
}
