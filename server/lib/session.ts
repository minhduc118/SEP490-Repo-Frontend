/**
 * Stateless session: AES-256-GCM encrypted cookie (GitHub token never readable by the browser).
 */
import crypto from 'crypto';
import type { Request, Response } from 'express';

export type AuthProvider = 'github' | 'password';

export interface SessionUser {
  login: string;
  name: string;
  role: 'admin' | 'leader' | 'member';
  avatarUrl?: string;
  provider: AuthProvider;
}

interface SessionPayload {
  user: SessionUser;
  token?: string;
  exp: number;
}

const COOKIE_NAME = 'ts_session';
const STATE_COOKIE = 'ts_oauth_state';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

if (!process.env.SESSION_SECRET) {
  console.warn('[TeamSpec API] SESSION_SECRET not set — sessions will reset on every server restart');
}
const KEY = crypto
  .createHash('sha256')
  .update(process.env.SESSION_SECRET ?? crypto.randomBytes(32).toString('hex'))
  .digest();

function encrypt(data: object): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

function decrypt<T>(value: string): T | null {
  try {
    const raw = Buffer.from(value, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const json = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map(part => {
      const idx = part.indexOf('=');
      return [part.slice(0, idx).trim(), decodeURIComponent(part.slice(idx + 1).trim())];
    }),
  );
}

const cookieBase = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

export function readSession(req: Request): SessionPayload | null {
  const value = parseCookies(req)[COOKIE_NAME];
  if (!value) return null;
  const payload = decrypt<SessionPayload>(value);
  if (!payload || payload.exp < Date.now()) return null;
  return payload;
}

export function writeSession(res: Response, user: SessionUser, token?: string): void {
  const payload: SessionPayload = { user, token, exp: Date.now() + MAX_AGE_MS };
  res.cookie(COOKIE_NAME, encrypt(payload), { ...cookieBase, maxAge: MAX_AGE_MS });
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE_NAME, cookieBase);
}

export function createOAuthState(res: Response): string {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, state, { ...cookieBase, maxAge: 10 * 60 * 1000 });
  return state;
}

export function consumeOAuthState(req: Request, res: Response, state: unknown): boolean {
  const expected = parseCookies(req)[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, cookieBase);
  return typeof state === 'string' && !!expected && state === expected;
}
