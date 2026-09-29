/**
 * TeamSpec API hooks — TanStack Query wrappers
 * Dùng thay cho MOCK_CHANGES khi server đang chạy
 */
import { useQuery } from '@tanstack/react-query';
import type { ChangeWithCompliance, DashboardStats, TeamMember } from '../types';
import type { AuthUser } from './teamMembers';

export type {
  ArtifactStatus, ChangeMode, ChangeWithCompliance, ComplianceResult,
  DashboardStats, StageResult, TeamMember, Violation,
} from '../types';

const API_BASE = '/api';

export interface ArtifactContent {
  file: string;
  content: string;
  gitInfo?: { author: string; email: string; date: string; message: string } | null;
}

// ── API fetchers ──────────────────────────────────────────────────────────────
async function fetchChanges(): Promise<{ changes: ChangeWithCompliance[]; meta: Record<string, unknown> }> {
  const res = await fetch(`${API_BASE}/changes`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function fetchChange(name: string): Promise<ChangeWithCompliance> {
  const res = await fetch(`${API_BASE}/changes/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function fetchArtifact(changeName: string, file: string): Promise<ArtifactContent> {
  const res = await fetch(`${API_BASE}/changes/${encodeURIComponent(changeName)}/artifact?file=${encodeURIComponent(file)}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function fetchStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function fetchCompliance(): Promise<{ members: TeamMember[]; commonViolations: { message: string; count: number }[] }> {
  const res = await fetch(`${API_BASE}/compliance`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface HealthInfo {
  status: string;
  source?: { mode: 'local' | 'github'; label: string };
}

async function fetchHealth(): Promise<HealthInfo> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Server offline');
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface AuthConfig {
  github: boolean;
  password: boolean;
  repo: string | null;
  source: 'local' | 'github';
}

async function fetchAuthConfig(): Promise<AuthConfig> {
  const res = await fetch(`${API_BASE}/auth/config`);
  if (!res.ok) throw new ApiError(res.status, 'Cannot load auth config');
  return res.json();
}

async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch(`${API_BASE}/auth/me`);
  if (!res.ok) throw new ApiError(res.status, 'Not authenticated');
  return (await res.json()).user;
}

export async function loginWithPassword(login: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, password }),
  });
  if (!res.ok) throw new ApiError(res.status, res.status === 401 ? 'Sai username hoặc password' : 'Đăng nhập thất bại');
  return (await res.json()).user;
}

export async function logoutFromServer(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST' }).catch(() => undefined);
}

export const GITHUB_LOGIN_URL = `${API_BASE}/auth/github`;

// ── React Query hooks ─────────────────────────────────────────────────────────

/** Kiểm tra server có đang chạy không */
export function useApiHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: 1,
    staleTime: 10_000,
  });
}

/** Login methods the server supports (only queried while the server is online) */
export function useAuthConfig(enabled: boolean) {
  return useQuery({
    queryKey: ['auth', 'config'],
    queryFn: fetchAuthConfig,
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

/** Current server session */
export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

/** List tất cả changes */
export function useChanges() {
  return useQuery({
    queryKey: ['changes'],
    queryFn: fetchChanges,
    staleTime: 30_000,
    select: data => data.changes,
  });
}

/** Chi tiết 1 change */
export function useChange(name: string) {
  return useQuery({
    queryKey: ['change', name],
    queryFn: () => fetchChange(name),
    staleTime: 30_000,
    enabled: !!name,
  });
}

/** Đọc nội dung đầy đủ 1 artifact file */
export function useArtifactContent(changeName: string, file: string | null) {
  return useQuery({
    queryKey: ['artifact', changeName, file],
    queryFn: () => fetchArtifact(changeName, file!),
    staleTime: 60_000,
    enabled: !!changeName && !!file,
  });
}

/** Dashboard stats */
export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    staleTime: 30_000,
  });
}

/** Team compliance */
export function useCompliance() {
  return useQuery({
    queryKey: ['compliance'],
    queryFn: fetchCompliance,
    staleTime: 30_000,
  });
}
