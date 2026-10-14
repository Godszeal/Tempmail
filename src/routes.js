import { Router } from 'express';
import {
  getDomains,
  createEmail,
  getInbox,
  getMessage,
  waitForMessage
} from './smailpro.js';

const router = Router();

const WAIT_MAX_MS = Number(process.env.WAIT_MAX_MS || 120000);

function fail(res, status, message, extra = {}) {
  res.status(status).json({ success: false, error: message, ...extra });
}

function pick(req, name) {
  if (req.query && req.query[name] !== undefined) return req.query[name];
  if (req.body && req.body[name] !== undefined) return req.body[name];
  return undefined;
}

// GET /health
router.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok', uptime: process.uptime() });
});

// GET /domains
router.get('/domains', async (_req, res) => {
  try {
    const domains = await getDomains();
    res.json({ success: true, ...domains });
  } catch (err) {
    fail(res, 500, err.message || 'Failed to fetch domains');
  }
});

// GET|POST /create
router.all('/create', async (req, res) => {
  try {
    const result = await createEmail({
      domain: pick(req, 'domain'),
      username: pick(req, 'username'),
      type: pick(req, 'type'),
      server: pick(req, 'server'),
      userAgent: pick(req, 'userAgent')
    });
    res.json(result);
  } catch (err) {
    fail(res, 502, err.message || 'Failed to create email');
  }
});

// GET|POST /inbox
router.all('/inbox', async (req, res) => {
  try {
    const address = pick(req, 'address');
    if (!address) return fail(res, 400, 'address is required');

    const account = {
      address,
      timestamp: pick(req, 'timestamp') ? Number(pick(req, 'timestamp')) : undefined,
      key: pick(req, 'key') || null,
      cookie: pick(req, 'cookie') || ''
    };

    const result = await getInbox(account, {
      userAgent: pick(req, 'userAgent')
    });
    res.json(result);
  } catch (err) {
    fail(res, 502, err.message || 'Failed to fetch inbox');
  }
});

// GET|POST /message
router.all('/message', async (req, res) => {
  try {
    const address = pick(req, 'address');
    const mid = pick(req, 'mid');
    if (!address) return fail(res, 400, 'address is required');
    if (!mid) return fail(res, 400, 'mid is required');

    const account = { address, cookie: pick(req, 'cookie') || '' };

    const result = await getMessage(account, mid, {
      userAgent: pick(req, 'userAgent')
    });
    res.json(result);
  } catch (err) {
    fail(res, 502, err.message || 'Failed to fetch message');
  }
});

// GET|POST /wait
router.all('/wait', async (req, res) => {
  try {
    const address = pick(req, 'address');
    if (!address) return fail(res, 400, 'address is required');

    const timeoutMs = Number(pick(req, 'timeoutMs') || 60000);
    const intervalMs = Number(pick(req, 'intervalMs') || 4000);
    const contains = pick(req, 'contains') || null;
    const fetchBody = pick(req, 'fetchBody') !== false;

    const effectiveTimeout = Math.min(timeoutMs, WAIT_MAX_MS);

    const account = {
      address,
      timestamp: pick(req, 'timestamp') ? Number(pick(req, 'timestamp')) : undefined,
      key: pick(req, 'key') || null,
      cookie: pick(req, 'cookie') || ''
    };

    const filterFn = contains
      ? (msg) => JSON.stringify(msg).toLowerCase().includes(String(contains).toLowerCase())
      : null;

    const result = await waitForMessage(account, {
      timeoutMs: effectiveTimeout,
      intervalMs,
      filter: filterFn,
      fetchBody,
      userAgent: pick(req, 'userAgent')
    });

    res.json({ success: true, ...result });
  } catch (err) {
    const msg = err.message || 'Failed while waiting for message';
    const isTimeout = /Timeout waiting/.test(msg);
    fail(res, isTimeout ? 504 : 502, msg);
  }
});

export default router;
