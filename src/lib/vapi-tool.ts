import type { NextRequest } from 'next/server';

/**
 * Helpers for endpoints that Vapi calls as a custom tool.
 *
 * Vapi has shipped more than one payload shape over time, so we accept both
 * the current `message.toolCallList` form and the older `message.toolCalls`
 * form, plus a plain `{ ... }` body so the same endpoint can be driven from
 * our own UI and from curl during testing.
 */

export type ParsedToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseArguments(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      return asRecord(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  return asRecord(raw);
}

/** Extract tool calls from a Vapi webhook body. Empty array if it isn't one. */
export function parseToolCalls(body: unknown): ParsedToolCall[] {
  const message = asRecord(asRecord(body).message);
  const calls: ParsedToolCall[] = [];

  // Current shape: message.toolCallList[] = { id, name, arguments }
  const list = message.toolCallList;
  if (Array.isArray(list)) {
    for (const entry of list) {
      const item = asRecord(entry);
      const fn = asRecord(item.function);
      const name = (item.name ?? fn.name) as string | undefined;
      if (!name) continue;
      calls.push({
        id: String(item.id ?? ''),
        name,
        args: parseArguments(item.arguments ?? fn.arguments),
      });
    }
  }

  // Legacy shape: message.toolCalls[] = { id, function: { name, arguments } }
  const legacy = message.toolCalls;
  if (!calls.length && Array.isArray(legacy)) {
    for (const entry of legacy) {
      const item = asRecord(entry);
      const fn = asRecord(item.function);
      const name = fn.name as string | undefined;
      if (!name) continue;
      calls.push({
        id: String(item.id ?? ''),
        name,
        args: parseArguments(fn.arguments),
      });
    }
  }

  return calls;
}

/** The call id, when Vapi includes call context on the webhook. */
export function extractCallId(body: unknown): string | undefined {
  const message = asRecord(asRecord(body).message);
  const call = asRecord(message.call);
  const id = call.id;
  return typeof id === 'string' ? id : undefined;
}

export function extractCallMetadata(body: unknown): Record<string, unknown> {
  const message = asRecord(asRecord(body).message);
  const call = asRecord(message.call);
  return asRecord(call.metadata);
}

/** The response shape Vapi expects back from a tool endpoint. */
export function toolResponse(results: { toolCallId: string; result: string }[]) {
  return { results };
}

/**
 * Reject a request that claims to be a voice-platform webhook but doesn't
 * carry the shared secret. Returns null when the request is allowed.
 *
 * This deliberately gates *webhook-shaped* traffic only. The same endpoints
 * also serve the public website (the contact form, the text-chat panel),
 * which runs in a visitor's browser and can never hold a secret. Those
 * requests are validated on their own merits instead — see the route
 * handlers. Applying the secret to everything would 401 the website's own
 * contact form the moment VAPI_WEBHOOK_SECRET is set.
 */
export function checkWebhookSecret(req: NextRequest, isWebhook: boolean): Response | null {
  if (!isWebhook) return null;

  const expected = process.env.VAPI_WEBHOOK_SECRET;
  if (!expected) return null; // not configured — open, as documented in .env.example

  const provided =
    req.headers.get('x-vara-secret') ||
    req.headers.get('x-vapi-secret') ||
    '';

  if (provided !== expected) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}
