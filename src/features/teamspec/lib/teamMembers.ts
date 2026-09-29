/**
 * TeamSpec — danh sách tài khoản đăng nhập (client-side, chỉ dùng cho demo nội bộ)
 */

export type MemberRole = 'admin' | 'leader' | 'member';

export interface TeamMemberCredential {
  login: string;
  name: string;
  password: string;
  role: MemberRole;
}

export type AuthProvider = 'github' | 'password' | 'offline';

export interface AuthUser extends Omit<TeamMemberCredential, 'password'> {
  avatarUrl?: string;
  provider?: AuthProvider;
}

const TEAM_PASSWORD = 'sgms2026';

export const TEAM_MEMBERS: TeamMemberCredential[] = [
  { login: 'admin', name: 'Administrator', password: 'admin123', role: 'admin' },
  { login: 'userA', name: 'User A', password: TEAM_PASSWORD, role: 'leader' },
  { login: 'userB', name: 'User B', password: TEAM_PASSWORD, role: 'member' },
  { login: 'userC', name: 'User C', password: TEAM_PASSWORD, role: 'member' },
  { login: 'userD', name: 'User D', password: TEAM_PASSWORD, role: 'member' },
  { login: 'userE', name: 'User E', password: TEAM_PASSWORD, role: 'member' },
];

export function verifyCredentials(login: string, password: string): AuthUser | null {
  const normalized = login.trim().toLowerCase();
  const pwd = password.trim();
  const member = TEAM_MEMBERS.find(
    m => m.login.toLowerCase() === normalized && m.password === pwd,
  );
  if (!member) return null;
  return { login: member.login, name: member.name, role: member.role };
}
