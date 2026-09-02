import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Support form relay. Sends the message through Mailgun so the maintainer's
 * address never appears in the page. Configuration comes from the host's
 * environment, never from the repo.
 */
const env = (key: string): string | undefined =>
  (typeof process !== 'undefined' ? process.env[key] : undefined) ?? (import.meta.env as Record<string, string | undefined>)[key];

const LIMITS = { name: 100, email: 200, message: 5000 } as const;
const MIN_MESSAGE = 10;
const MIN_FILL_MS = 3000;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 5;

// Best-effort per-instance rate limit; serverless instances do not share it.
const recent = new Map<string, number[]>();
const isRateLimited = (ip: string): boolean => {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > RATE_MAX;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Parsed = { ok: true; name: string; email: string; message: string } | { ok: false; error: string };

function parse(form: FormData): Parsed {
  const str = (k: string) => String(form.get(k) ?? '').trim();
  const name = str('name');
  const email = str('email');
  const message = str('message');
  // Honeypot: real people never see this field.
  if (str('website')) return { ok: false, error: 'Rejected.' };
  const started = Number(str('started'));
  if (!Number.isFinite(started) || Date.now() - started < MIN_FILL_MS) return { ok: false, error: 'That was quick. Please try again.' };
  if (!EMAIL.test(email) || email.length > LIMITS.email) return { ok: false, error: 'Please enter a valid email address.' };
  if (message.length < MIN_MESSAGE) return { ok: false, error: 'Please write a little more.' };
  if (message.length > LIMITS.message) return { ok: false, error: `Please keep it under ${LIMITS.message} characters.` };
  if (name.length > LIMITS.name) return { ok: false, error: 'That name is too long.' };
  return { ok: true, name, email, message };
}

async function sendViaMailgun(p: { name: string; email: string; message: string }): Promise<void> {
  const key = env('MAILGUN_API_KEY');
  const domain = env('MAILGUN_DOMAIN');
  const to = env('SUPPORT_TO');
  if (!key || !domain || !to) throw new Error('Mailgun is not configured');
  const host = env('MAILGUN_REGION') === 'eu' ? 'api.eu.mailgun.net' : 'api.mailgun.net';
  const body = new URLSearchParams({
    from: `Quoth support <support@${domain}>`,
    to,
    'h:Reply-To': p.name ? `${p.name.replace(/[<>"]/g, '')} <${p.email}>` : p.email,
    subject: `[quoth.dev] Support request from ${p.name || p.email}`,
    text: `From: ${p.name || '(no name)'} <${p.email}>\n\n${p.message}`,
  });
  const res = await fetch(`https://${host}/v3/${domain}/messages`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`api:${key}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Mailgun responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

const respond = (request: Request, status: number, payload: { ok: boolean; error?: string }) => {
  const wantsJson = request.headers.get('accept')?.includes('application/json');
  if (wantsJson) return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
  const url = new URL('/support', request.url);
  url.searchParams.set(payload.ok ? 'sent' : 'error', payload.ok ? '1' : payload.error ?? 'Something went wrong.');
  return Response.redirect(url.toString(), 303);
};

export const POST: APIRoute = async ({ request, clientAddress, site }) => {
  const origin = request.headers.get('origin');
  if (origin && site && new URL(origin).host !== site.host && !origin.includes('localhost')) {
    return respond(request, 403, { ok: false, error: 'Forbidden.' });
  }
  if (isRateLimited(clientAddress)) return respond(request, 429, { ok: false, error: 'Too many messages. Please try again later.' });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return respond(request, 400, { ok: false, error: 'Bad request.' });
  }
  const parsed = parse(form);
  if (!parsed.ok) return respond(request, 400, { ok: false, error: parsed.error });

  try {
    await sendViaMailgun(parsed);
  } catch (err) {
    console.error('[support] send failed:', err instanceof Error ? err.message : err);
    return respond(request, 502, { ok: false, error: 'Could not send right now. Please try again later.' });
  }
  return respond(request, 200, { ok: true });
};
