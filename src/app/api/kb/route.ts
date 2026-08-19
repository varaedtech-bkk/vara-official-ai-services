import type { NextRequest } from 'next/server';
import { searchKnowledge, formatHitsForVoice, formatSkillsForVoice } from '@/lib/kb';
import { parseToolCalls, toolResponse, checkWebhookSecret, extractCallMetadata } from '@/lib/vapi-tool';
import { getTenant } from '@/lib/saas/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * search_knowledge tool endpoint.
 *
 * Accepts a Vapi tool-call webhook, or a plain { query, lang } body — the
 * latter is handy for testing retrieval with curl.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  const toolCalls = parseToolCalls(body);

  // Secret is required for webhook-shaped payloads only; the plain form below
  // is the public site's own search surface over public marketing content.
  const unauthorized = checkWebhookSecret(req, toolCalls.length > 0);
  if (unauthorized) return unauthorized;

  /* ---- Vapi tool call ---- */
  if (toolCalls.length) {
    const meta = extractCallMetadata(body);
    const slug = typeof meta.tenantSlug === 'string' ? meta.tenantSlug : '';
    const tenant = slug ? getTenant(slug) : undefined;

    const results = toolCalls.map((call) => {
      const query = typeof call.args.query === 'string' ? call.args.query : '';
      if (!query.trim()) {
        return {
          toolCallId: call.id,
          result: 'No query was provided. Ask the caller to clarify what they want to know.',
        };
      }
      if (tenant && tenant.slug !== 'vara' && tenant.skills.length) {
        const result = formatSkillsForVoice(tenant.skills, query);
        console.log(`[kb] tenant=${tenant.slug} query="${query}" skills=${tenant.skills.length}`);
        return { toolCallId: call.id, result };
      }
      const hits = searchKnowledge(query, { limit: 4 });
      console.log(`[kb] tool query="${query}" hits=${hits.length}`);
      return { toolCallId: call.id, result: formatHitsForVoice(hits) };
    });

    return Response.json(toolResponse(results));
  }

  /* ---- direct call from our own UI ---- */
  const plain = (body ?? {}) as { query?: string; lang?: 'en' | 'th'; limit?: number };
  const query = (plain.query || '').trim();
  if (!query) return Response.json({ error: 'query is required' }, { status: 400 });

  const hits = searchKnowledge(query, {
    limit: Math.min(Math.max(plain.limit ?? 5, 1), 10),
    lang: plain.lang === 'th' ? 'th' : 'en',
  });

  return Response.json({
    query,
    count: hits.length,
    hits: hits.map((hit) => ({
      doc: hit.docTitle,
      heading: hit.heading,
      text: hit.text,
      score: Number(hit.score.toFixed(3)),
    })),
  });
}
