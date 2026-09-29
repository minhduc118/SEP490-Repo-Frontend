import type { Response } from 'express';
import { GithubError } from './github.js';

export function sendError(res: Response, error: unknown): void {
  if (error instanceof GithubError) {
    const rateLimited = error.status === 403 || error.status === 429;
    res.status(502).json({
      error: rateLimited
        ? 'GitHub API rate limit hoặc thiếu quyền — đăng nhập GitHub hoặc đặt GITHUB_TOKEN'
        : error.message,
    });
    return;
  }
  res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
}
