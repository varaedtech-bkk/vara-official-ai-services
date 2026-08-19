/**
 * Single source of truth for the two Vara assistants (English + Thai).
 *
 * Used by scripts/sync-assistants.mjs to create/update them on Vapi, and by
 * `npm run vapi:print` to emit paste-ready JSON for the Vapi dashboard.
 *
 * Voice pipeline rationale:
 *  - English: Deepgram nova-3 (fast, accurate EN) + Vapi's own Elliot voice.
 *  - Thai:    Azure STT th-TH + Azure Neural TTS th-TH. Azure is the reliable
 *             Thai path — Deepgram's "multi" model and ElevenLabs turbo/flash
 *             v2.5 do NOT cover Thai. Do not "simplify" this to Deepgram multi.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const readPrompt = (lang) =>
  readFileSync(join(HERE, `system-prompt.${lang}.md`), 'utf8').trim();

export const FIRST_MESSAGE = {
  en: "Hi, this is Sara from VARA EdTech. How may I help you?",
  th: 'สวัสดีค่ะ ดิฉันซาร่า จาก VARA EdTech ค่ะ ให้ดิฉันช่วยอะไรดีคะ',
};

const END_CALL_MESSAGE = {
  en: 'Thanks for your time. Someone from the VARA team will follow up. Have a great day.',
  th: 'ขอบคุณมากค่ะ เดี๋ยวทีมงาน VARA ติดต่อกลับนะคะ ขอให้เป็นวันที่ดีค่ะ',
};

const VOICEMAIL_SAFE_TIMEOUT = {
  en: 'Are you still there? I am happy to keep going whenever you are ready.',
  th: 'ยังอยู่ไหมคะ ยินดีคุยต่อเมื่อท่านพร้อมนะคะ',
};

/* ------------------------------------------------------------------ tools */

function buildTools(baseUrl, lang, secret) {
  // Shared secret so our API can reject anything that isn't Vapi calling.
  const headers = secret ? { 'x-vara-secret': secret } : undefined;

  const kbDescription =
    'Look up detailed VARA EdTech information that is not already in your instructions: specific services, product capabilities, pricing tables, client references, university programme details, policies, or FAQ answers. Call this silently — never tell the caller you are searching.';

  const leadDescription =
    'Save a visitor so VARA EdTech can follow up AND so the platform can email them a confirmation immediately. Call this the moment you have a confirmed email address (or a phone number if they refused email). Do not wait until the end of the call. Always include the email field when they gave one. Call it once per conversation unless they give materially new information.';

  return [
    {
      type: 'function',
      async: false,
      function: {
        name: 'search_knowledge',
        description: kbDescription,
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'The information need, in English, as a short search phrase. Example: "AEO pricing for universities" or "TutExperts institution pilot".',
            },
          },
          required: ['query'],
        },
      },
      server: { url: `${baseUrl}/api/kb`, timeoutSeconds: 15, headers },
      messages: [
        {
          type: 'request-failed',
          content:
            lang === 'th'
              ? 'ขออภัยครับ ตรงนี้ผมขอให้ผู้เชี่ยวชาญของเรายืนยันให้ดีกว่านะครับ'
              : "I'd rather have one of our specialists confirm that properly than guess.",
        },
      ],
    },
    {
      type: 'function',
      async: false,
      function: {
        name: 'capture_lead',
        description: leadDescription,
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: "The visitor's full name." },
            organization: {
              type: 'string',
              description: 'University, company or government body they represent.',
            },
            role: { type: 'string', description: 'Their job title or role, if mentioned.' },
            email: {
              type: 'string',
              description:
                'Visitor email, if given. Required whenever they asked to be emailed. Read it back to confirm, then pass the exact address. This triggers an automatic confirmation email from our platform.',
            },
            phone: { type: 'string', description: 'Phone or WhatsApp number, if given.' },
            interest: {
              type: 'string',
              description:
                'What they are interested in. Examples: AI voice assistant, AEO, VR/AR education, university partnership, AI training workshops, chatbot, custom software.',
            },
            audience: {
              type: 'string',
              enum: ['university', 'business', 'government', 'student', 'other'],
              description: 'Which segment this visitor belongs to.',
            },
            notes: {
              type: 'string',
              description:
                'Anything useful they said about their situation, timeline, budget signals, or the specific problem they want solved.',
            },
            preferredContact: {
              type: 'string',
              enum: ['email', 'phone', 'whatsapp', 'line', 'any'],
              description:
                'The channel the visitor chose. Ask for this explicitly rather than assuming — then make sure the matching field (email, or phone) is filled in.',
            },
            requestType: {
              type: 'string',
              enum: ['proposal', 'quote', 'callback', 'meeting', 'information', 'other'],
              description:
                'What the visitor actually asked for. Use "proposal" when they ask you to send a proposal, brochure or company profile; "quote" when they want pricing in writing; "callback" or "meeting" when they want to speak to someone.',
            },
            topic: {
              type: 'string',
              description:
                'What the proposal or follow-up should cover — the service, the faculty, the problem they described. This is what lets the team send something relevant rather than generic.',
            },
          },
          // preferredContact is required so the model cannot save a lead
          // without having asked how to reach them. If they genuinely refuse
          // to choose, it can pass "any".
          required: ['name', 'interest', 'preferredContact'],
        },
      },
      server: { url: `${baseUrl}/api/lead`, timeoutSeconds: 15, headers },
      messages: [
        {
          type: 'request-failed',
          content:
            lang === 'th'
              // The browser mirrors every capture to the same API, so the
              // details are already stored even when this webhook cannot be
              // reached. Confirm normally rather than alarming the visitor.
              ? 'บันทึกเรียบร้อยครับ ให้ยืนยันกับผู้สนทนาว่าส่งให้ทีมงานแล้ว และจะติดต่อกลับภายใน 24 ชั่วโมง'
              : 'Noted. Confirm that a confirmation email is on its way if they gave an address, and that the team will follow up within 24 hours.',
        },
      ],
    },
  ];
}

/* ------------------------------------------------------------- transcriber */

function buildTranscriber(lang) {
  if (lang === 'th') {
    // Azure is the dependable Thai STT path inside Vapi.
    return {
      provider: 'azure',
      language: 'th-TH',
      segmentationStrategy: 'Semantic',
    };
  }
  return {
    provider: 'deepgram',
    model: 'nova-3',
    language: 'en',
    smartFormat: true,
  };
}

/* -------------------------------------------------------------------- voice */

function buildVoice(lang, env = {}) {
  if (lang === 'th') {
    return {
      provider: 'azure',
      // Premwadee is Azure's Thai female neural voice — Sara presents as female.
      voiceId: env.VAPI_TH_VOICE_ID || 'th-TH-PremwadeeNeural',
      speed: 0.97,
      fallbackPlan: {
        voices: [{ provider: 'openai', voiceId: 'echo' }],
      },
    };
  }
  return {
    provider: 'vapi',
    // Clara: female Vapi V2 voice. Sara is the spoken name (like Siri).
    // Override with VAPI_EN_VOICE_ID (Savannah, Emma, Layla, Naina also work).
    voiceId: env.VAPI_EN_VOICE_ID || 'Clara',
    version: 2,
    speed: 0.96,
    // No fallbackPlan here on purpose: the API rejects one for the Vapi voice
    // provider, because its own managed auto-fallback is always on.
  };
}

/* ---------------------------------------------------------------- assistant */

/**
 * @param {'en'|'th'} lang
 * @param {{ baseUrl: string, env?: Record<string,string|undefined> }} opts
 */
export function buildAssistant(lang, { baseUrl, env = {} }) {
  const url = baseUrl.replace(/\/+$/, '');

  return {
    name: lang === 'th' ? 'Sara — VARA EdTech (TH)' : 'Sara — VARA EdTech (EN)',

    firstMessage: FIRST_MESSAGE[lang],
    firstMessageMode: 'assistant-speaks-first',

    transcriber: buildTranscriber(lang),
    voice: buildVoice(lang, env),

    model: {
      provider: 'openai',
      model: env.VAPI_LLM_MODEL || 'gpt-4o',
      temperature: 0.35,
      // Shorter cap = fewer tokens to generate = audio starts sooner. The
      // prompt already asks for two or three sentences.
      maxTokens: 220,
      messages: [{ role: 'system', content: readPrompt(lang) }],
      tools: buildTools(url, lang, env.VAPI_WEBHOOK_SECRET),
    },

    // Conversation feel
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 900,
    backgroundSound: 'off',
    backchannelingEnabled: false,
    backgroundDenoisingEnabled: true,
    modelOutputInMessagesEnabled: true,

    // Latency tuning. waitSeconds is the single biggest lever on how quickly
    // Vara answers after you stop talking; smart endpointing keeps that safe
    // by detecting a finished sentence rather than just a silence gap.
    startSpeakingPlan: {
      waitSeconds: 0.15,
      smartEndpointingEnabled: true,
    },
    // numWords 0 = cut off the instant the caller speaks, so interrupting
    // feels immediate rather than talking over him.
    stopSpeakingPlan: {
      numWords: 0,
      voiceSeconds: 0.15,
      backoffSeconds: 0.5,
    },

    messagePlan: {
      idleMessages: [VOICEMAIL_SAFE_TIMEOUT[lang]],
      idleMessageMaxSpokenCount: 2,
      idleTimeoutSeconds: 20,
    },

    endCallMessage: END_CALL_MESSAGE[lang],
    endCallFunctionEnabled: true,

    // Unambiguous sign-offs hang up on their own. Deliberately no bare "thanks"
    // or "okay" here — people say those mid-conversation, and cutting someone
    // off is far worse than staying on the line a beat too long. Anything more
    // subtle is left to the model, per the closing section of the prompt.
    endCallPhrases:
      lang === 'th'
        ? ['ลาก่อน', 'บาย', 'แค่นี้ครับ', 'แค่นี้ค่ะ', 'พอแค่นี้', 'ไว้คุยกันใหม่', 'ขอบคุณครับ บาย']
        : [
            'goodbye',
            'good bye',
            'bye bye',
            'bye for now',
            'talk to you later',
            "that's all thanks",
            'that is all thank you',
            'nothing else thanks',
            'no more questions thanks',
          ],

    // Events the browser UI listens to for live transcript + status.
    clientMessages: [
      'transcript',
      'function-call',
      'tool-calls',
      'speech-update',
      'status-update',
      'conversation-update',
      'metadata',
    ],

    // Events posted to our own server (see /api/vapi/events).
    serverMessages: ['end-of-call-report', 'status-update'],
    server: {
      url: `${url}/api/vapi/events`,
      timeoutSeconds: 20,
      ...(env.VAPI_WEBHOOK_SECRET
        ? { headers: { 'x-vara-secret': env.VAPI_WEBHOOK_SECRET } }
        : {}),
    },

    analysisPlan: {
      summaryPlan: {
        enabled: true,
        messages: [
          {
            role: 'system',
            content:
              'Summarise this conversation between a website visitor and Sara, the VARA EdTech assistant, in 3 sentences or fewer. Note who the visitor is, any email or phone they gave, what they wanted, and whether they asked to be contacted.',
          },
          { role: 'user', content: 'Transcript:\n\n{{transcript}}' },
        ],
      },
      structuredDataPlan: {
        enabled: true,
        schema: {
          type: 'object',
          properties: {
            visitorName: { type: 'string' },
            organization: { type: 'string' },
            email: { type: 'string', description: 'Visitor email if spoken or spelled in the call.' },
            phone: { type: 'string' },
            preferredContact: { type: 'string', enum: ['email', 'phone', 'whatsapp', 'line', 'any'] },
            requestType: {
              type: 'string',
              enum: ['proposal', 'quote', 'callback', 'meeting', 'information', 'other'],
            },
            audience: { type: 'string', enum: ['university', 'business', 'government', 'student', 'other'] },
            servicesDiscussed: { type: 'array', items: { type: 'string' } },
            wantsFollowUp: { type: 'boolean' },
            contactProvided: { type: 'boolean' },
          },
        },
      },
      successEvaluationPlan: {
        enabled: true,
        rubric: 'PassFail',
      },
    },

    metadata: {
      brand: 'VARA EdTech',
      surface: 'website-assistant',
      language: lang,
    },
  };
}

export const LANGS = ['en', 'th'];
