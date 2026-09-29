/**
 * Per-request context (GitHub token of the logged-in user) without threading it through every call.
 */
import { AsyncLocalStorage } from 'async_hooks';
import type { NextFunction, Request, Response } from 'express';
import { readSession, type SessionUser } from './session.js';

interface RequestContext {
  user?: SessionUser;
  githubToken?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
  return storage.getStore() ?? {};
}

export function requestContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const session = readSession(req);
  storage.run({ user: session?.user, githubToken: session?.token }, next);
}

export function requireAuth(_req: Request, res: Response, next: NextFunction): void {
  if (!getRequestContext().user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  next();
}
