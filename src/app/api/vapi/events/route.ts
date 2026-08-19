import type { NextRequest } from 'next/server';
import { annotateCall, saveLead, readLeads } from '@/lib/leads';
import { checkWebhookSecret } from '@/lib/vapi-tool';
import { sendFollowUpEmail } from '@/lib/email';
import { firstVisitorEmail } from '@/lib/contact';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AnyRecord = Record<string, unknown>;

const rec = (value: unknown): AnyRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {};

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

/**
 * Server-side events from Vapi (end-of-call reports and status updates).
 *
 * When a call ends we attach the transcript and summary to the lead captured
 * during that call. If the visitor spoke an email but capture_lead never
 * fired (or never reached us), we still save the lead and send the
 * confirmation email so the dashboard Email Log is not empty.
 */
export async function POST(req: NextRequest) {
  const unauthorized = checkWebhookSecret(req, true);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: true });
  }

  const message = rec(rec(body).message);
  const type = str(message.type);

  if (type !== 'end-of-call-report') {
    return Response.json({ ok: true });
  }

  const call = rec(message.call);
  const callId = str(call.id);
  const transcript = str(message.transcript);
  const analysis = rec(message.analysis);
  const summary = str(analysis.summary) || str(message.summary);
  const structured = rec(analysis.structuredData);
  const metadata = rec(call.metadata);
  const language = metadata.language === 'th' ? 'th' : 'en';
  const tenantSlug = str(metadata.tenantSlug);

  if (!callId) return Response.json({ ok: true });

  const email =
    str(structured.email) ||
    firstVisitorEmail(str(structured.email), summary, transcript);

  const attached = annotateCall(callId, { transcript, summary });

  const wantsFollowUp = structured.wantsFollowUp === true;
  const contactProvided = structured.contactProvided === true;

  if (attached) {
    const existing = readLeads().find((l) => l.callId === callId);
    if (existing && email && !existing.email) {
      const updated = saveLead({ ...existing, email, source: existing.source });
      void sendFollowUpEmail(updated);
    } else if (existing?.email) {
      void sendFollowUpEmail(existing);
    }
    console.log(`[events] end-of-call ${callId} attached=true email=${email ?? '-'}`);
    return Response.json({ ok: true });
  }

  if (wantsFollowUp || contactProvided || email) {
    const recovered = saveLead({
      source: 'voice',
      language,
      callId,
      tenantSlug,
      tenantId: tenantSlug,
      name: str(structured.visitorName),
      organization: str(structured.organization),
      audience: str(structured.audience),
      email,
      phone: str(structured.phone),
      preferredContact: str(structured.preferredContact) || (email ? 'email' : undefined),
      requestType: str(structured.requestType),
      interest: Array.isArray(structured.servicesDiscussed)
        ? structured.servicesDiscussed.filter((s) => typeof s === 'string').join(', ')
        : undefined,
      notes:
        'Recovered from end-of-call analysis — assistant did not capture details during the call.',
      transcript,
      summary,
    });
    console.log(`[events] recovered lead from call ${callId} email=${email ?? '-'}`);
    if (recovered.email) void sendFollowUpEmail(recovered);
  } else {
    console.log(`[events] end-of-call ${callId} attached=false no follow-up`);
  }

  return Response.json({ ok: true });
}
