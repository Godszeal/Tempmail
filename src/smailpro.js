import {
  BASE_URL,
  API_SONJJ_URL,
  SITE_KEY,
  DEFAULT_API_KEY,
  DEFAULT_USER_AGENT,
  DOMAINS
} from './constants.js';

async function solveTurnstile(action = 'smailpro_create', options = {}) {
  const apiKey = options.apiKey || DEFAULT_API_KEY;
  const siteKey = options.siteKey || SITE_KEY;
  const targetUrl = options.targetUrl || `${BASE_URL}/temporary-email`;

  const solverUrl = `https://fgsi.dpdns.org/api/tools/cfclearance/turnstile-min?apikey=${encodeURIComponent(
    apiKey
  )}&url=${encodeURIComponent(targetUrl)}&sitekey=${encodeURIComponent(
    siteKey
  )}&action=${encodeURIComponent(action)}`;

  const res = await fetch(solverUrl);
  if (!res.ok) {
    throw new Error(`Turnstile solver failed (${res.status})`);
  }

  const data = await res.json();
  const token = data.data?.token;
  if (!token) {
    throw new Error('Turnstile solver did not return a valid token');
  }

  return token;
}

async function getSessionCookies(userAgent = DEFAULT_USER_AGENT) {
  const res = await fetch(`${BASE_URL}/temporary-email`, {
    headers: { 'User-Agent': userAgent }
  });

  if (!res.ok) {
    throw new Error(`Failed to initialize session with SmailPro (${res.status})`);
  }

  const getSetCookie = res.headers.getSetCookie
    ? res.headers.getSetCookie.bind(res.headers)
    : null;
  const rawCookies = getSetCookie
    ? getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean);
  const cookieStr = rawCookies.map((c) => c.split(';')[0]).join('; ');

  return cookieStr;
}

export function detectProvider(domain) {
  const d = String(domain || '').trim().toLowerCase();
  if (
    DOMAINS.google.includes(d) ||
    d.includes('gmail') ||
    d.includes('googlemail')
  ) {
    return 'google';
  }
  if (
    DOMAINS.microsoft.includes(d) ||
    d.includes('outlook') ||
    d.includes('hotmail')
  ) {
    return 'microsoft';
  }
  return 'other';
}

export async function getDomains(options = {}) {
  try {
    const res = await fetch(`${BASE_URL}/temporary-email`, {
      headers: { 'User-Agent': options.userAgent || DEFAULT_USER_AGENT }
    });

    if (res.ok) {
      const html = await res.text();
      const match = html.match(/otherDomains:\s*(\{[\s\S]*?\})\s*,\s*settings:/);
      if (match) {
        const parsed = JSON.parse(match[1]);
        const freeNames = parsed.freeNames || [];
        const edu = freeNames.filter((n) => n.includes('.edu.'));
        const other = freeNames.filter((n) => !n.includes('.edu.'));

        return {
          google: [...DOMAINS.google],
          microsoft: [...DOMAINS.microsoft],
          edu: edu.length ? edu : [...DOMAINS.edu],
          other: other.length ? other : [...DOMAINS.other],
          all: [
            ...DOMAINS.google,
            ...DOMAINS.microsoft,
            ...(edu.length ? edu : DOMAINS.edu),
            ...(other.length ? other : DOMAINS.other)
          ]
        };
      }
    }
  } catch {}

  return {
    google: [...DOMAINS.google],
    microsoft: [...DOMAINS.microsoft],
    edu: [...DOMAINS.edu],
    other: [...DOMAINS.other],
    all: [
      ...DOMAINS.google,
      ...DOMAINS.microsoft,
      ...DOMAINS.edu,
      ...DOMAINS.other
    ]
  };
}

export async function createEmail(options = {}) {
  const userAgent = options.userAgent || DEFAULT_USER_AGENT;
  let domain = options.domain
    ? String(options.domain).trim().toLowerCase()
    : 'gmail.com';
  let username = options.username ? String(options.username).trim() : 'random';
  const type = options.type || 'alias';
  const server = String(options.server || '1');

  if (domain === 'random') {
    domain = 'singapore.edu.pl';
  }

  const provider = detectProvider(domain);

  const queryParams = { username, type, domain, server };

  const [cookieStr, captchaToken] = await Promise.all([
    getSessionCookies(userAgent),
    solveTurnstile('smailpro_create', options)
  ]);

  const qs = new URLSearchParams(queryParams).toString();
  const createUrl = `${BASE_URL}/app/create?${qs}`;

  const res = await fetch(createUrl, {
    headers: {
      'User-Agent': userAgent,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Cookie: cookieStr,
      Referer: `${BASE_URL}/temporary-email`,
      'x-captcha': captchaToken
    }
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data || data.code === 403 || !data.address) {
    const errMsg =
      data?.msg || data?.message || `Failed to create email (${res.status})`;
    throw new Error(errMsg);
  }

  const address = data.address;
  const actualDomain = address.includes('@') ? address.split('@')[1] : domain;
  const actualUser = address.includes('@') ? address.split('@')[0] : username;

  return {
    success: true,
    address,
    username: actualUser,
    domain: actualDomain,
    provider: detectProvider(actualDomain),
    timestamp: data.timestamp || Math.floor(Date.now() / 1000),
    key: data.key,
    expired_at: data.expired_at || null,
    cookie: cookieStr
  };
}

export async function getInbox(account, options = {}) {
  if (!account) {
    throw new Error('Account object or address string is required');
  }

  const address = typeof account === 'string' ? account.trim() : account.address;
  const timestamp =
    typeof account === 'object' && account.timestamp
      ? account.timestamp
      : Math.floor(Date.now() / 1000) - 86400;
  const key = typeof account === 'object' && account.key ? account.key : null;
  const cookie =
    typeof account === 'object' && account.cookie ? account.cookie : '';
  const userAgent = options.userAgent || DEFAULT_USER_AGENT;

  if (!address) {
    throw new Error('Valid email address is required');
  }

  const provider = detectProvider(address);
  const endpointMap = {
    google: `${API_SONJJ_URL}/temp_gmail/inbox`,
    microsoft: `${API_SONJJ_URL}/temp_outlook/inbox`,
    other: `${API_SONJJ_URL}/temp_email/inbox`
  };
  const sonjjInboxUrl = endpointMap[provider] || endpointMap.other;

  const cookieStr = cookie || (await getSessionCookies(userAgent));

  const payloadRes = await fetch(`${BASE_URL}/app/inbox`, {
    method: 'POST',
    headers: {
      'User-Agent': userAgent,
      'Content-Type': 'application/json',
      Cookie: cookieStr,
      Referer: `${BASE_URL}/temporary-email`
    },
    body: JSON.stringify([{ address, timestamp, key }])
  });

  if (!payloadRes.ok) {
    throw new Error(`Failed to request inbox payload (${payloadRes.status})`);
  }

  const payloadData = await payloadRes.json().catch(() => null);
  const item = Array.isArray(payloadData) ? payloadData[0] : null;

  if (!item || !item.payload) {
    return { success: true, address, provider, total: 0, messages: [] };
  }

  const sonjjRes = await fetch(
    `${sonjjInboxUrl}?payload=${encodeURIComponent(item.payload)}`,
    { headers: { 'User-Agent': userAgent } }
  );

  if (!sonjjRes.ok) {
    const errText = await sonjjRes.text().catch(() => '');
    throw new Error(
      `Mail server rejected inbox check (${sonjjRes.status}): ${errText}`
    );
  }

  const result = await sonjjRes.json().catch(() => ({ messages: [] }));
  const messages = Array.isArray(result.messages) ? result.messages : [];

  return {
    success: true,
    address,
    provider,
    total: messages.length,
    messages
  };
}

export async function getMessage(account, mid, options = {}) {
  if (!account) {
    throw new Error('Account object or address string is required');
  }
  if (!mid) {
    throw new Error('Message ID (mid) is required');
  }

  const address = typeof account === 'string' ? account.trim() : account.address;
  const cookie =
    typeof account === 'object' && account.cookie ? account.cookie : '';
  const userAgent = options.userAgent || DEFAULT_USER_AGENT;

  const provider = detectProvider(address);
  const endpointMap = {
    google: `${API_SONJJ_URL}/temp_gmail/message`,
    microsoft: `${API_SONJJ_URL}/temp_outlook/message`,
    other: `${API_SONJJ_URL}/temp_email/message`
  };
  const sonjjMessageUrl = endpointMap[provider] || endpointMap.other;

  const [cookieStr, captchaToken] = await Promise.all([
    cookie ? Promise.resolve(cookie) : getSessionCookies(userAgent),
    solveTurnstile('smailpro_message', options)
  ]);

  const qs = new URLSearchParams({ email: address, mid }).toString();
  const payloadRes = await fetch(`${BASE_URL}/app/message?${qs}`, {
    headers: {
      'User-Agent': userAgent,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Cookie: cookieStr,
      Referer: `${BASE_URL}/temporary-email`,
      'x-captcha': captchaToken
    }
  });

  if (!payloadRes.ok) {
    throw new Error(`Failed to request message payload (${payloadRes.status})`);
  }

  const payload = await payloadRes.text();
  if (!payload) {
    throw new Error('Empty payload returned from message server');
  }

  const sonjjRes = await fetch(
    `${sonjjMessageUrl}?payload=${encodeURIComponent(payload)}`,
    { headers: { 'User-Agent': userAgent } }
  );

  if (!sonjjRes.ok) {
    throw new Error(`Mail server rejected message fetch (${sonjjRes.status})`);
  }

  const data = await sonjjRes.json().catch(() => null);

  return {
    success: true,
    address,
    mid,
    provider,
    body: data?.body || '',
    attachments: data?.attachments || []
  };
}

export async function waitForMessage(account, options = {}) {
  const timeoutMs = options.timeoutMs || 60000;
  const intervalMs = options.intervalMs || 4000;
  const filterFn = typeof options.filter === 'function' ? options.filter : null;
  const autoFetchBody = options.fetchBody !== false;

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const inbox = await getInbox(account, options);
    if (inbox.total > 0) {
      let matched = inbox.messages;
      if (filterFn) {
        matched = inbox.messages.filter(filterFn);
      }

      if (matched.length > 0) {
        const latest = matched[0];
        if (autoFetchBody && latest.mid) {
          try {
            const fullMsg = await getMessage(account, latest.mid, options);
            return {
              ...latest,
              body: fullMsg.body,
              attachments: fullMsg.attachments
            };
          } catch {}
        }
        return latest;
      }
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    `Timeout waiting for incoming message after ${timeoutMs / 1000}s`
  );
}

export { DOMAINS };
