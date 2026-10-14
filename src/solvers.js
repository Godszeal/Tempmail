import {
  BASE_URL,
  SITE_KEY,
  SOLVER_PROVIDER,
  CAPSOLVER_KEY,
  TWOCAPTCHA_KEY,
  DEFAULT_FGSI_API_KEY
} from './constants.js';

// ---------- CapSolver ----------
async function solveWithCapSolver(action, options = {}) {
  const apiKey = options.apiKey || CAPSOLVER_KEY;
  if (!apiKey) throw new Error('CapSolver API key is not configured (set CAPSOLVER_KEY)');

  const siteKey = options.siteKey || SITE_KEY;
  const targetUrl = options.targetUrl || `${BASE_URL}/temporary-email`;

  const createRes = await fetch('https://api.capsolver.com/createTask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientKey: apiKey,
      task: {
        type: 'AntiTurnstileTaskProxyLess',
        websiteURL: targetUrl,
        websiteKey: siteKey,
        metadata: { action }
      }
    })
  });

  const createData = await createRes.json().catch(() => null);
  if (!createData) throw new Error('CapSolver createTask: empty response');
  if (createData.errorId !== 0) {
    throw new Error(
      `CapSolver createTask: ${createData.errorDescription || createData.errorCode}`
    );
  }

  const taskId = createData.taskId;
  if (!taskId) throw new Error('CapSolver createTask: no taskId returned');

  const timeoutMs = options.solverTimeoutMs || 90000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));

    const pollRes = await fetch('https://api.capsolver.com/getTaskResult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientKey: apiKey, taskId })
    });

    const pollData = await pollRes.json().catch(() => null);
    if (!pollData) continue;

    if (pollData.status === 'ready') {
      const token =
        pollData.solution?.token ||
        pollData.solution?.gRecaptchaResponse ||
        pollData.solution?.turnstileToken;
      if (!token) throw new Error('CapSolver returned no token');
      return token;
    }

    if (pollData.errorId && pollData.errorId !== 0) {
      throw new Error(
        `CapSolver getTaskResult: ${pollData.errorDescription || pollData.errorCode}`
      );
    }
  }

  throw new Error('CapSolver timed out waiting for token');
}

// ---------- 2Captcha ----------
async function solveWith2Captcha(action, options = {}) {
  const apiKey = options.apiKey || TWOCAPTCHA_KEY;
  if (!apiKey) throw new Error('2Captcha API key is not configured (set TWOCAPTCHA_KEY)');

  const siteKey = options.siteKey || SITE_KEY;
  const targetUrl = options.targetUrl || `${BASE_URL}/temporary-email`;

  const submitRes = await fetch('https://2captcha.com/in.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: apiKey,
      method: 'turnstile',
      sitekey: siteKey,
      pageurl: targetUrl,
      action,
      json: 1
    })
  });

  const submitData = await submitRes.json().catch(() => null);
  if (!submitData) throw new Error('2Captcha in.php: empty response');
  if (submitData.status !== 1) {
    throw new Error(`2Captcha in.php: ${submitData.request || 'unknown error'}`);
  }

  const taskId = submitData.request;

  const timeoutMs = options.solverTimeoutMs || 90000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));

    const pollUrl = `https://2captcha.com/res.php?key=${encodeURIComponent(
      apiKey
    )}&action=get&id=${encodeURIComponent(taskId)}&json=1`;
    const pollRes = await fetch(pollUrl);
    const pollData = await pollRes.json().catch(() => null);
    if (!pollData) continue;

    if (pollData.status === 1 && pollData.request) {
      return pollData.request;
    }

    if (pollData.request && pollData.request !== 'CAPCHA_NOT_READY') {
      throw new Error(`2Captcha res.php: ${pollData.request}`);
    }
  }

  throw new Error('2Captcha timed out waiting for token');
}

// ---------- Fgsi (legacy, IP-whitelisted) ----------
async function solveWithFgsi(action, options = {}) {
  const apiKey = options.apiKey || DEFAULT_FGSI_API_KEY;
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

  const data = await res.json().catch(() => null);
  const token = data?.data?.token;
  if (!token) {
    const reason = data?.message || data?.error || 'no token in response';
    throw new Error(`Fgsi solver: ${reason}`);
  }

  return token;
}

// ---------- Dispatcher ----------
export async function solveTurnstile(action = 'smailpro_create', options = {}) {
  const provider = (options.provider || SOLVER_PROVIDER).toLowerCase();

  switch (provider) {
    case 'capsolver':
      return solveWithCapSolver(action, options);
    case '2captcha':
    case 'twocaptcha':
      return solveWith2Captcha(action, options);
    case 'fgsi':
      return solveWithFgsi(action, options);
    default:
      throw new Error(`Unknown solver provider: ${provider}`);
  }
}
