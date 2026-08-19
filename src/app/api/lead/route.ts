import type { NextRequest } from 'next/server';
import { saveLead, type Lead } from '@/lib/leads';
import {
  parseToolCalls,
  extractCallId,
  extractCallMetadata,
  toolResponse,
  checkWebhookSecret,
} from '@/lib/vapi-tool';
import { sendFollowUpEmail } from '@/lib/email';
import { isCompanyEmail } from '@/lib/contact';
import { notifyLiveAgentStaff } from '@/lib/live-agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

/** What the model should say back, tailored to what the visitor asked for. */
function confirmation(language: 'en' | 'th', requestType?: string, channel?: string): string {
  const wants = requestType === 'proposal' || requestType === 'quote';
  const via = channel && channel !== 'any' ? channel : undefined;
  const live = requestType === 'live-agent' || requestType === 'callback' || requestType === 'live_agent';

  if (language === 'th') {
    if (live) {
      return 'ถ้ายังไม่มีอีเมลหรือเบอร์ ห้ามสัญญาว่าจะโทรกลับ ให้ขอชื่อกับอีเมลหรือเบอร์ก่อน ห้ามบอกว่าต่อสายในแชทนี้ เมื่อมีช่องทางติดต่อแล้ว บอกว่าทีมจะอีเมลหรือโทรกลับโดยเร็ว หากเร่งด่วนให้ WhatsApp +66 94 887 7955';
    }
    return wants
      ? `บันทึกแล้ว ให้ยืนยันว่าได้ส่งให้ทีมงานแล้ว และทีมจะส่ง${requestType === 'quote' ? 'ใบเสนอราคา' : 'ข้อเสนอ'}ไปทาง${via ? ' ' + via : 'ช่องทางที่แจ้งไว้'} ภายใน 24 ชั่วโมง ห้ามบอกว่าคุณส่งเอง`
      : 'บันทึกแล้ว ให้ยืนยันกับผู้สนทนาอย่างอบอุ่นว่าได้ส่งข้อมูลให้ทีมงานแล้ว และจะมีคนติดต่อกลับภายใน 24 ชั่วโมง';
  }
  if (live) {
    return 'If they have not given an email or phone, do not promise a callback — ask for name and email or phone first. Do not say you connected a live agent. Once you have contact: a teammate will email or call back ASAP; urgent WhatsApp +66 94 887 7955.';
  }
  return wants
    ? `Saved. A confirmation email is being sent to their address now. Confirm warmly that they will get a short confirmation from VARA EdTech shortly, and that the team will send the ${requestType} ${via ? 'by ' + via : ''} within 24 hours. Do not say you personally sent the proposal.`
    : 'Saved. A confirmation email is being sent if they gave an email. Confirm warmly that they will hear from VARA EdTech shortly, and that someone will follow up within 24 hours.';
}

/**
 * capture_lead tool endpoint, plus a plain JSON path for any browser-side
 * caller (no contact form ships today — the voice tool is the live path).
 *
 * Leads are appended to data/leads.jsonl. Nothing leaves the server.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  const toolCalls = parseToolCalls(body);

  // The shared secret guards the voice tool call. The plain-JSON path below
  // is for browser-side callers, which cannot hold a secret, so it is
  // validated by its own field rules instead.
  const unauthorized = checkWebhookSecret(req, toolCalls.length > 0);
  if (unauthorized) return unauthorized;

  /* ---- Vapi tool call ---- */
  if (toolCalls.length) {
    const callId = extractCallId(body);
    const meta = extractCallMetadata(body);
    const tenantSlug = typeof meta.tenantSlug === 'string' ? meta.tenantSlug : undefined;

    const results = toolCalls.map((call) => {
      const a = call.args;
      const language = str(a.language) === 'th' ? 'th' : 'en';
      const email = str(a.email);

      if (isCompanyEmail(email)) {
        return {
          toolCallId: call.id,
          result:
            language === 'th'
              ? 'นั่นเป็นอีเมลของบริษัท VARA EdTech ไม่ใช่ของผู้สนทนา ห้ามบันทึก บอกสุภาพว่า info@varaedtech.com เป็นอีเมลของเรา แล้วขออีเมลส่วนตัวหรืออีเมลที่ทำงานของท่านแทน'
              : "That is a VARA EdTech company address, not the visitor's. Do not save it. Tell them politely that this is OUR email (for example info@varaedtech.com), and ask for THEIR personal or work email instead.",
        };
      }

      const lead = saveLead({
        source: 'voice',
        language,
        callId,
        tenantSlug,
        tenantId: tenantSlug,
        name: str(a.name),
        organization: str(a.organization),
        role: str(a.role),
        email,
        phone: str(a.phone),
        interest: str(a.interest),
        requestType: str(a.requestType),
        topic: str(a.topic),
        audience: str(a.audience),
        notes: str(a.notes),
        preferredContact: str(a.preferredContact),
      });

      console.log(
        `[lead] voice capture id=${lead.id} type="${lead.requestType ?? 'general'}" ` +
          `name="${lead.name ?? '-'}" org="${lead.organization ?? '-'}" ` +
          `via="${lead.preferredContact ?? '-'}" interest="${lead.interest ?? '-'}"`
      );

      // Fire-and-forget — email failure must not delay Sunny's spoken reply.
      if (lead.requestType === 'live-agent' || lead.requestType === 'live_agent') {
        void notifyLiveAgentStaff(
          lead,
          str(a.notes) || str(a.interest) || 'Voice visitor asked for a live agent',
        );
      } else if (lead.email) {
        void sendFollowUpEmail(lead);
      }

      return {
        toolCallId: call.id,
        result: confirmation(language, lead.requestType, lead.preferredContact),
      };
    });

    return Response.json(toolResponse(results));
  }

  /* ---- plain JSON submission (browser-side caller) ---- */
  const form = (body ?? {}) as Partial<Lead> & { source?: Lead['source'] };

  const name = str(form.name);
  const email = str(form.email);
  const phone = str(form.phone);

  // A save mirrored from the live voice session. Vara has already decided this
  // is worth keeping, and may legitimately have only a name and a channel, so
  // the stricter contact rule below does not apply.
  const fromVoice = form.source === 'voice';

  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }
  if (!fromVoice && !email && !phone) {
    return Response.json(
      { error: 'name and either email or phone are required' },
      { status: 400 }
    );
  }
  if (email && isCompanyEmail(email)) {
    return Response.json(
      { error: 'that is a VARA EdTech company email, not a visitor address' },
      { status: 400 },
    );
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return Response.json({ error: 'invalid email' }, { status: 400 });
  }

  const lead = saveLead({
    source: fromVoice ? 'voice' : form.source === 'chat' ? 'chat' : 'form',
    callId: str(form.callId),
    language: form.language === 'th' ? 'th' : 'en',
    tenantId: str(form.tenantId),
    tenantSlug: str(form.tenantSlug),
    name,
    email,
    phone,
    organization: str(form.organization),
    role: str(form.role),
    interest: str(form.interest),
    requestType: str(form.requestType),
    topic: str(form.topic),
    audience: str(form.audience),
    notes: str(form.notes),
    preferredContact: str(form.preferredContact),
  });

  console.log(`[lead] form capture id=${lead.id} name="${name}"`);

  if (lead.email) void sendFollowUpEmail(lead);

  return Response.json({ ok: true, id: lead.id });
}
