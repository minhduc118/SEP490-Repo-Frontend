// ─── TeamSpec Monitor — Content Viewer (Markdown Renderer) ───────────────────
// Pure JS markdown renderer — không cần thư viện ngoài
import { useState } from 'react';
import { useArtifactContent } from '../lib/api';
import type { ArtifactStatus } from '../types';
import { Button, CloseButton, EmptyState, Modal } from './ui';
import { cn } from '../lib/styles';
import { MARKDOWN_CLASS, markdownToHtml } from '../lib/markdown';

// ─── Mock artifact content map (dùng khi server offline) ──────────────────────
const MOCK_CONTENT: Record<string, string> = {
  '.session.md': `---
assignee: userA
mode: full
project: MT-GRMS
started_at: "2026-09-18T08:00:00Z"
---

# Session: auth-login-feature

## Mục tiêu
Implement tính năng đăng nhập cho hệ thống MT-GRMS với JWT authentication.

## Context
- Hệ thống cần hỗ trợ multi-tenant với role-based access control
- Backend: Spring Boot + Spring Security
- Frontend: React + Zustand

## Ghi chú
- Cần check với security team về token expiry policy
- Test case bao gồm cả edge case khi token hết hạn mid-session
`,

  'proposal.md': `# Proposal: auth-login-feature

## Tóm tắt vấn đề
Hệ thống chưa có authentication. User có thể truy cập tất cả routes mà không cần đăng nhập.

## Giải pháp đề xuất
1. **JWT Authentication** — stateless, dễ scale
2. **Refresh Token** — lưu trong httpOnly cookie để bảo mật
3. **Role-based routing** — redirect theo role (admin/employee/manager)

## Trade-offs
- JWT: khó revoke ngay lập tức → cần blacklist mechanism
- Session: đơn giản hơn nhưng không scale với microservices

## Kết luận
Chọn JWT + refresh token pattern. Blacklist lưu trong Redis.
`,

  'exploration.md': `# Exploration: auth-login-feature

## Các approach đã nghiên cứu

### Approach 1: Spring Security JWT
- Sử dụng **jjwt** library
- Filter chain: JwtAuthFilter → UsernamePasswordAuthFilter
- Pros: Mature, well-documented
- Cons: Boilerplate khá nhiều

### Approach 2: Spring OAuth2 Resource Server
- Built-in JWT validation
- Pros: Ít code hơn, native Spring Security
- Cons: Cần cấu hình phức tạp hơn nếu custom claims

## Kết quả spike
Approach 1 phù hợp hơn vì team đã familiar với jjwt. 
Test implementation trong 2 giờ → Hoạt động tốt.
`,

  'design-brief.md': `# Design Brief: auth-login-feature

## API Design

### POST /api/auth/login
\`\`\`json
{
  "username": "string",
  "password": "string",
  "tenantId": "string"
}
\`\`\`

Response:
\`\`\`json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 3600,
  "user": {
    "id": "uuid",
    "role": "EMPLOYEE | MANAGER | ADMIN",
    "tenantId": "string"
  }
}
\`\`\`

### POST /api/auth/refresh
\`\`\`json
{ "refreshToken": "eyJ..." }
\`\`\`

## Frontend Flow
1. Login form → POST /api/auth/login
2. Lưu accessToken vào memory (Zustand)
3. Lưu refreshToken vào httpOnly cookie
4. Axios interceptor tự động refresh khi 401
`,

  'specs.md': `# Specs: auth-login-feature

## Functional Requirements

### FR-01: Login
- User nhập username + password
- System validate credentials với database
- Nếu valid: trả về JWT + refresh token
- Nếu invalid: trả về 401 với message rõ ràng (không tiết lộ field nào sai)

### FR-02: Logout
- Revoke refresh token (xóa khỏi Redis)
- Clear httpOnly cookie ở client

### FR-03: Auto refresh
- Khi accessToken hết hạn (401), tự động gọi /api/auth/refresh
- Nếu refresh cũng fail → logout + redirect về login

### FR-04: Role-based routing
- ADMIN → /admin
- MANAGER → /manager
- EMPLOYEE → /dashboard

## Non-functional Requirements
- Response time < 200ms cho login
- Token expiry: access 1h, refresh 7 days
- Rate limiting: max 5 failed attempts / 15 minutes / IP

## Acceptance Criteria
- [ ] Login flow hoạt động end-to-end
- [ ] Refresh token hoạt động tự động
- [ ] Role redirect đúng
- [ ] Rate limiting hoạt động
`,

  'review/skeptic.md': `# Skeptic Review: auth-login-feature

## Reviewer: skeptic-bot (AI)
## Reviewed by: userB

---

## 🔴 Critical Issues

### C01: Missing CSRF Protection
**Problem**: Refresh token trong httpOnly cookie nhưng không có CSRF token mechanism.
**Impact**: CSRF attack có thể exploit refresh endpoint.
**Recommendation**: Implement Double Submit Cookie pattern hoặc SameSite=Strict.

## 🟡 Warnings

### W01: Redis Dependency
**Problem**: Blacklist/refresh token cần Redis. Nếu Redis down → không refresh được.
**Recommendation**: Fallback mechanism + health check alert.

### W02: Rate Limiting chưa có test
**Problem**: Specs mention rate limiting nhưng chưa có test case cụ thể.
**Recommendation**: Thêm integration test cho rate limit behavior.

## ✅ Approved items
- JWT structure đúng chuẩn
- Refresh token rotation pattern hợp lý
- Error messages không expose sensitive info

---

**Overall**: Cần fix C01 trước khi merge.
`,

  'tasks.md': `# Tasks: auth-login-feature

## Backend Tasks

- [x] Setup JWT dependency (jjwt 0.12.x)
- [x] JwtService: generate + validate token
- [x] JwtAuthFilter: extract token từ header
- [ ] POST /api/auth/login endpoint
- [ ] POST /api/auth/refresh endpoint
- [ ] POST /api/auth/logout endpoint
- [ ] Redis integration cho blacklist
- [ ] Rate limiting với Bucket4j
- [ ] Unit tests: JwtService
- [ ] Integration tests: auth endpoints

## Frontend Tasks

- [x] Login page UI
- [x] Zustand auth store
- [ ] Axios interceptor cho auto-refresh
- [ ] Role-based route guard
- [ ] Logout flow
- [ ] Error handling UI (show toast)

## DevOps

- [ ] Cấu hình Redis trong docker-compose
- [ ] Environment variables cho JWT secrets
- [ ] Health check endpoint
`,
};

// ─── ContentViewer Component ──────────────────────────────────────────────────
interface ContentViewerProps {
  artifact: ArtifactStatus & { file: string };
  changeName: string;
  onClose: () => void;
  useApi?: boolean;
}

function placeholderContent(changeName: string, file: string): string {
  return `# ${file}\n\n> Nội dung này sẽ được load từ:\n> \`openspec/changes/${changeName}/${file}\`\n\n*Kết nối với team-ai-knowledge filesystem để xem nội dung thực tế.*`;
}

export function ContentViewer({ artifact, changeName, onClose, useApi = false }: ContentViewerProps) {
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError, refetch } = useArtifactContent(
    changeName,
    useApi && artifact.exists ? artifact.file : null,
  );

  const rawContent = useApi
    ? data?.content ?? artifact.preview ?? ''
    : MOCK_CONTENT[artifact.file] ?? placeholderContent(changeName, artifact.file);

  const author = data?.gitInfo?.author ?? artifact.author;
  const updatedAt = data?.gitInfo?.date ?? artifact.updatedAt;

  const htmlContent = markdownToHtml(rawContent);

  function handleCopy() {
    if (!rawContent) return;
    navigator.clipboard.writeText(rawContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Modal onClose={onClose} className="max-w-3xl">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', artifact.exists ? 'bg-indigo-500/15' : 'bg-rose-500/15')}>
            {artifact.exists ? '📄' : '❌'}
          </span>
          <div className="min-w-0">
            <div className="truncate font-mono text-sm font-semibold text-zinc-900">{artifact.file}</div>
            <div className="truncate text-[11px] text-zinc-500">
              {changeName} · {author ? `@${author}` : 'unknown author'}
              {updatedAt && <> · {new Date(updatedAt).toLocaleDateString('vi-VN')}</>}
              {!useApi && <> · mock</>}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            onClick={handleCopy}
            className={cn('h-8 px-3 text-xs', copied && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700')}
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </Button>
          <CloseButton onClick={onClose} />
        </div>
      </div>

      {useApi && isLoading ? (
        <EmptyState icon="⏳" sub={`Đang tải ${artifact.file}…`} />
      ) : (
        <>
          {useApi && isError && (
            <div className="mx-5 mt-3 flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-700">
              ⚠️ Không tải được nội dung đầy đủ{rawContent ? ' — đang hiện bản preview' : ''}.
              <Button variant="link" onClick={() => refetch()} className="text-xs">Thử lại</Button>
            </div>
          )}
          <ViewerTabs rawContent={rawContent} htmlContent={htmlContent} />
        </>
      )}
    </Modal>
  );
}

// ─── Preview / Raw tabs ───────────────────────────────────────────────────────


function ViewerTabs({ rawContent, htmlContent }: { rawContent: string; htmlContent: string }) {
  const [tab, setTab] = useState<'preview' | 'raw'>('preview');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 gap-1 border-b border-zinc-200 px-5">
        {(['preview', 'raw'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              '-mb-px cursor-pointer border-b-2 px-3 py-2.5 text-xs font-medium transition-colors',
              tab === t ? 'border-indigo-400 text-indigo-700' : 'border-transparent text-zinc-500 hover:text-zinc-700',
            )}
          >
            {t === 'preview' ? '👁 Preview' : '📝 Raw'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin">
        {tab === 'preview' ? (
          <div
            className={MARKDOWN_CLASS}
            // biome-ignore lint/security/noDangerouslySetInnerHtml
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        ) : (
          <pre className="m-0 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-zinc-700">{rawContent}</pre>
        )}
      </div>
    </div>
  );
}
