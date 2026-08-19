import { readLeads, saveLead, type Lead } from '@/lib/leads';
import { sendFollowUpEmail } from '@/lib/email';
import { buildEmailBody, inferClientAsk, pickSkillsForAsk, type EmailPassage } from '@/lib/email-template';
import { searchKnowledge } from '@/lib/kb';
import { readSession } from '@/lib/saas/session';
import { getTenant } from '@/lib/saas/store';

export type SendEmailInput = {
  preview?: boolean;
  leadId?: string;
  email?: string;
  name?: string;
  callId?: string;
  interest?: string;
  topic?: string;
  summary?: string;
  subject?: string;
  text?: string;
};

export type SendEmailResult = {
  ok: boolean;
  error?: string;
  status?: number;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
};

function resolveLead(body: SendEmailInput): { lead: Lead } | { error: string; status: number } {
  if (body.leadId) {
    const lead = readLeads().find((l) => l.id === body.leadId);
    if (!lead) return { error: 'lead not found', status: 404 };
    const email = body.email?.trim() || lead.email;
    if (!email) return { error: 'lead has no email address', status: 400 };
    return {
      lead: {
        ...lead,
        email,
        name: body.name || lead.name,
        interest: body.interest || lead.interest,
        topic: body.topic || lead.topic,
        summary: body.summary || lead.summary,
      },
    };
  }

  const email = body.email?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { error: 'valid email required', status: 400 };
  }

  const existing =
    (body.callId ? readLeads().find((l) => l.callId === body.callId) : undefined) ||
    readLeads().find((l) => l.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    return {
      lead: {
        ...existing,
        email,
        name: body.name || existing.name,
        interest: body.interest || existing.interest,
        topic: body.topic || existing.topic,
        summary: body.summary || existing.summary,
      },
    };
  }

  return {
    lead: {
      id: 'preview',
      createdAt: new Date().toISOString(),
      source: 'voice',
      language: 'en',
      email,
      name: body.name,
      callId: body.callId,
      interest: body.interest,
      topic: body.topic,
      summary: body.summary,
      preferredContact: 'email',
    },
  };
}

function kbToPassages(query: string): EmailPassage[] {
  return searchKnowledge(query, { limit: 3, lang: 'en' }).map((hit) => ({
    title: hit.heading || hit.docTitle,
    body: hit.text
      .replace(/^---[\s\S]*?---/, '')
      .replace(/^#+\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/^\s*[-*]\s+/gm, '• ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 900),
  }));
}

function clientDraft(lead: Lead, tenant: ReturnType<typeof getTenant>) {
  const ask = inferClientAsk(lead.summary, lead.interest, lead.topic);
  const fromSkills = pickSkillsForAsk(tenant?.skills ?? [], ask);
  const fromKb =
    !tenant || tenant.slug === 'vara' || !tenant.skills.length ? kbToPassages(ask) : [];
  const seen = new Set<string>();
  const passages: EmailPassage[] = [];
  for (const p of [...fromSkills, ...fromKb]) {
    const key = p.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    passages.push(p);
    if (passages.length >= 3) break;
  }

  return buildEmailBody(
    lead,
    {
      companyName: tenant?.companyName,
      assistantName: tenant?.assistantName,
      fromEmail: tenant?.smtp?.from || process.env.EMAIL_FROM || process.env.EMAIL_USER,
      website: tenant?.website,
    },
    { ask, passages },
  );
}

export async function handleDashboardSendEmail(
  body: SendEmailInput,
  req?: Request,
): Promise<SendEmailResult> {
  const session = await readSession(req);
  if (!session) return { ok: false, error: 'unauthorized', status: 401 };

  const resolved = resolveLead(body);
  if ('error' in resolved) {
    return { ok: false, error: resolved.error, status: resolved.status };
  }

  const { lead } = resolved;
  if (!lead.email) return { ok: false, error: 'valid email required', status: 400 };

  const tenant = getTenant(session.tenantId || lead.tenantId || 'vara');
  const branded = { ...lead, tenantId: tenant?.id, tenantSlug: tenant?.slug };
  const draft = clientDraft(branded, tenant);

  if (body.preview) {
    return {
      ok: true,
      to: lead.email,
      subject: draft.subject,
      text: draft.text,
      html: draft.html,
    };
  }

  const saved =
    lead.id === 'preview'
      ? saveLead({
          source: 'voice',
          language: 'en',
          email: lead.email,
          name: lead.name,
          callId: lead.callId,
          interest: lead.interest,
          topic: lead.topic,
          preferredContact: 'email',
          tenantId: tenant?.id,
          tenantSlug: tenant?.slug,
          notes: 'Sent from dashboard after preview.',
        })
      : saveLead({
          ...lead,
          source: lead.source,
          email: lead.email,
          tenantId: lead.tenantId || tenant?.id,
          tenantSlug: lead.tenantSlug || tenant?.slug,
        });

  await sendFollowUpEmail(saved, {
    force: true,
    subject: body.subject || draft.subject,
    text: body.text || draft.text,
  });
  return { ok: true, to: saved.email ?? lead.email };
}
