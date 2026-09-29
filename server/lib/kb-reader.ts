/**
 * KBReader — đọc filesystem của team-ai-knowledge
 * Support LOCAL mode: đọc trực tiếp từ đường dẫn KB_PATH
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import matter from 'gray-matter';

// ── KB Path resolution ────────────────────────────────────────────────────────
export const KB_PATH = process.env.KB_PATH
  ? path.resolve(process.env.KB_PATH)
  : path.resolve(process.cwd(), '..', 'ai-team-kit', 'team-ai-knowledge');

export const OPENSPEC_PATH = path.join(KB_PATH, 'openspec', 'changes');

// ── File utilities ────────────────────────────────────────────────────────────
export function readFileLocal(relativePath: string): string | null {
  const fullPath = path.join(KB_PATH, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  try {
    return fs.readFileSync(fullPath, 'utf-8');
  } catch {
    return null;
  }
}

export function fileExistsLocal(relativePath: string): boolean {
  return fs.existsSync(path.join(KB_PATH, relativePath));
}

export function listChangeFolders(): string[] {
  if (!fs.existsSync(OPENSPEC_PATH)) return [];
  try {
    return fs.readdirSync(OPENSPEC_PATH, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('.'))
      .map(d => d.name);
  } catch {
    return [];
  }
}

export function listDirLocal(relativePath: string): string[] {
  const fullPath = path.join(KB_PATH, relativePath);
  if (!fs.existsSync(fullPath)) return [];
  try {
    return fs.readdirSync(fullPath);
  } catch {
    return [];
  }
}

// ── Frontmatter parser ────────────────────────────────────────────────────────
export interface Frontmatter {
  assignee?: string;
  mode?: 'full' | 'fast' | 'minimal';
  stage?: string;
  project?: string;
  started_at?: string;
  title?: string;
  scope?: string;
  status?: string;
  tags?: string[];
  [key: string]: unknown;
}

export function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  try {
    const { data, content: body } = matter(content);
    return { frontmatter: data as Frontmatter, body };
  } catch {
    return { frontmatter: {}, body: content };
  }
}

// ── Git history ───────────────────────────────────────────────────────────────
export interface GitFileInfo {
  author: string;
  email: string;
  date: string;
  message: string;
}

export function getFileGitInfo(relativePath: string): GitFileInfo | null {
  if (!fs.existsSync(KB_PATH + '/.git')) return null;
  try {
    const output = execSync(
      `git log -1 --format="%an|%ae|%aI|%s" -- "${relativePath}"`,
      { cwd: KB_PATH, encoding: 'utf-8', timeout: 3000 }
    ).trim();
    if (!output) return null;
    const [author, email, date, message] = output.replace(/^"|"$/g, '').split('|');
    return { author, email, date, message };
  } catch {
    return null;
  }
}

export function getChangeAuthors(changeName: string): string[] {
  if (!fs.existsSync(KB_PATH + '/.git')) return [];
  try {
    const output = execSync(
      `git log --format="%an" -- "openspec/changes/${changeName}/"`,
      { cwd: KB_PATH, encoding: 'utf-8', timeout: 3000 }
    ).trim();
    return [...new Set(output.split('\n').filter(Boolean))];
  } catch {
    return [];
  }
}
