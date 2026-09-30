# SGMS Frontend + TeamSpec Monitor

React + TypeScript + Vite. Gồm frontend sản phẩm MT-GRMS (`/dashboard`, `/products`) và **TeamSpec Monitor** tại `/teamspec` — web theo dõi team có làm đủ 6 bước SEP (`/sep-spec` → `/sep-archive`) cho từng change trong [ai-team-kit](https://github.com/minhduc118/ai-team-kit).

## Chạy local

```bash
npm install
cp .env.example .env      # sửa KB_SOURCE / KB_PATH hoặc GITHUB_*
npm run dev:all           # Vite :3000 + API :5000
```

Mở http://localhost:3000/teamspec. Server tắt → web tự chuyển sang dữ liệu mock.

| Lệnh | Việc |
|---|---|
| `npm run dev:all` | Vite + API (watch) |
| `npm test` | Test compliance engine, parser, timeline + so khớp với kit (`../ai-team-kit/team-ai-knowledge/mcp-server/dist`, tự bỏ qua nếu chưa build kit) |
| `npm run build` | Typecheck + build `dist/` |
| `npm start` | Chạy production (Express phục vụ `dist/` + `/api`) |

## TeamSpec — dữ liệu lấy từ đâu

Không dùng database. Nguồn sự thật là các file trong `openspec/` của KB (git):

| Trang | Đọc |
|---|---|
| Dashboard, Changes | `openspec/changes/<change>/` — `.status`, `.session.md` (schema, gate, approvals), artifact từng bước |
| Tasks | `tasks.md` (checklist, mã task, `REQ-xx`) đối chiếu `specs.md` |
| Chi tiết change | + lịch sử: git commit của thư mục change, `summary.md` (duyệt/từ chối), `improvements.md` |
| Specs | `openspec/specs/<capability>/spec.md` (merge khi `/sep-archive`) |

`KB_SOURCE=local` đọc thư mục `KB_PATH`; `KB_SOURCE=github` đọc repo qua GitHub API (cache 60s), `GITHUB_KB_DIR` là thư mục KB trong repo (`team-ai-knowledge`).

Quy tắc chấm điểm nằm ở `src/features/teamspec/lib/compliance.ts` và phải khớp `mcp-server/src/tools/sepWorkflow.ts` của kit — `npm test` kiểm tra điều này.

## Deploy lên Render (1 service, không database)

1. **GitHub OAuth App cho production** — github.com/settings/developers → New OAuth App
   - Homepage URL: `https://<tên-service>.onrender.com`
   - Callback URL: `https://<tên-service>.onrender.com/api/auth/github/callback`
2. **Token đọc KB** — github.com/settings/personal-access-tokens → Fine-grained, repo `minhduc118/ai-team-kit`, quyền *Contents: Read-only*.
3. **Render** → New → **Blueprint** → chọn repo này (`render.yaml`). Điền:
   - `APP_URL` = `https://<tên-service>.onrender.com`
   - `GITHUB_TOKEN`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
   - `GITHUB_ALLOWED_USERS` = tài khoản mentor (nếu mentor không phải collaborator)
4. Kiểm tra: `https://<tên-service>.onrender.com/api/health` → `source.label` = `github · minhduc118/ai-team-kit@main/team-ai-knowledge`, rồi đăng nhập GitHub tại `/teamspec`.

Ghi chú:
- Ai đăng nhập được: collaborator của repo KB, hoặc có trong `GITHUB_ALLOWED_USERS`. Đăng nhập bằng tài khoản nhóm (mật khẩu ghi trong code) bị tắt ở production — chỉ bật lại bằng `PASSWORD_LOGIN=true` khi demo.
- Gói free ngủ sau ~15 phút không truy cập (lần mở đầu chờ ~30–60s).
- Push lên `main` → Render tự deploy (`autoDeploy`); CI (`.github/workflows/ci.yml`) chạy lint + test + build.
- Dữ liệu mới từ MCP (commit vào `ai-team-kit`) hiện trên web sau tối đa ~60s (cache GitHub tree).
